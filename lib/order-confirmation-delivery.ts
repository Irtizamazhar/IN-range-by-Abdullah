import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendMailOutcome } from "@/lib/mailer";
import { orderConfirmationEmail, sellerShippedEmail, vendorOrderEmail, vendorServiceBookingEmail } from "@/lib/joro-email-templates";
import { orderConfirmationEligible, confirmationRetry } from "@/lib/order-confirmation-policy";

/** Called in the same transaction as the authoritative order/payment write. */
export async function queueOrderConfirmation(tx: Prisma.TransactionClient, order: { id: string; orderStatus: string; paymentMethod: string; paymentStatus: string }) {
  if (!orderConfirmationEligible(order)) return;
  const recipients = ["customer", ...(await tx.vendorShopOrder.findMany({ where: { orderId: order.id }, select: { id: true } })).map(shop => `vendor:${shop.id}`)];
  for (const recipientKey of recipients) {
    await tx.orderConfirmationEmail.upsert({ where: { orderId_recipientKey: { orderId: order.id, recipientKey } }, create: { orderId: order.id, recipientKey }, update: {} });
  }
}

/** One message per invocation bounds runtime; concurrent workers use an atomic claim. */
export async function deliverOrderConfirmation(db = prisma, send = sendMailOutcome) {
  const now = new Date();
  // A worker may die after SMTP acceptance. Preserve this ambiguity for operator review.
  await db.orderConfirmationEmail.updateMany({ where: { status: "sending", claimedAt: { lt: new Date(now.getTime() - 5 * 60_000) } }, data: { status: "uncertain", lastError: "Worker interrupted; reconcile SMTP before retry" } });
  const job = await db.orderConfirmationEmail.findFirst({ where: { status: "pending", attempts: { lt: 5 }, availableAt: { lte: now } }, orderBy: { availableAt: "asc" } });
  if (!job) return { processed: 0 };
  const claimed = await db.orderConfirmationEmail.updateMany({ where: { id: job.id, status: "pending", attempts: job.attempts, availableAt: { lte: now } }, data: { status: "sending", claimedAt: now, attempts: { increment: 1 } } });
  if (!claimed.count) return { processed: 0 };
  let order;
  let email;
  let recipient: string | undefined;
  try {
    order = await db.order.findUnique({ where: { id: job.orderId }, include: { customer: true, orderItems: true, couponRedemption: true, services: true } });
    if (order && (job.recipientKey.startsWith("shipped:") || orderConfirmationEligible(order))) {
      if (job.recipientKey.startsWith("shipped:")) {
        const shop = await db.vendorShopOrder.findFirst({ where: { id: job.recipientKey.slice(8), orderId: order.id }, include: { pickupRequest: { select: { status: true, trackingNumber: true } } } });
        if (shop && ["shipped", "delivered"].includes(shop.status) && shop.pickupRequest?.status === "handed_over" && shop.trackingNumber && shop.trackingNumber === shop.pickupRequest.trackingNumber && order.customer?.isActive) {
          recipient = order.customer.email;
          email = sellerShippedEmail({ orderId: order.id, orderNumber: order.orderNumber, shopOrderNumber: shop.shopOrderNumber, customerName: order.customerName, trackingNumber: shop.trackingNumber });
        }
      } else if (job.recipientKey.startsWith("vendor:")) {
        const shop = await db.vendorShopOrder.findFirst({ where: { id: job.recipientKey.slice(7), orderId: order.id }, include: { vendor: { select: { email: true, shopName: true, ownerName: true, status: true } } } });
        if (shop && shop.status !== "cancelled" && shop.vendor.status === "approved") {
          recipient = shop.vendor.email;
          email = vendorOrderEmail(order, shop);
        }
      } else if (job.recipientKey.startsWith("service:")) {
        const booking = await db.orderService.findFirst({ where: { id: job.recipientKey.slice(8), orderId: order.id, serviceId: null, productId: null, status: { notIn: ["CANCELLED", "FAILED"] } }, include: { vendor: { select: { email: true, shopName: true, status: true } } } });
        if (booking?.vendor.status === "approved") { recipient = booking.vendor.email; email = vendorServiceBookingEmail(order, booking); }
      } else if (job.recipientKey === "customer" && order.customer?.isActive) {
        recipient = order.customer.email;
        email = orderConfirmationEmail(order);
      }
    }
  } catch {
    // No SMTP call has begun, so this failure can safely be retried.
    await db.orderConfirmationEmail.update({ where: { id: job.id }, data: { status: job.attempts + 1 >= 5 ? "failed" : "pending", availableAt: confirmationRetry(job.attempts + 1), lastError: "Could not load order or prepare template" } });
    return { processed: 1 };
  }
  if (!email || !recipient || !/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(recipient)) {
    await db.orderConfirmationEmail.update({ where: { id: job.id }, data: { status: "skipped", lastError: "Order or owner no longer eligible" } });
    return { processed: 1 };
  }
  // Customer auth currently has no local email-verification flag. Google verification
  // remains enforced by the existing OAuth flow. Never use checkout-supplied email.
  let outcome: "accepted" | "retry" | "uncertain";
  try { outcome = await send({ to: recipient, ...email, messageId: `<joro-order-confirmation-${job.id}@joro.pk>` }); }
  catch { outcome = "uncertain"; }
  await db.orderConfirmationEmail.update({ where: { id: job.id }, data: {
    status: outcome === "accepted" ? "accepted" : outcome === "uncertain" ? "uncertain" : job.attempts + 1 >= 5 ? "failed" : "pending",
    acceptedAt: outcome === "accepted" ? new Date() : null,
    lastError: outcome === "accepted" ? null : outcome === "uncertain" ? "SMTP outcome uncertain; reconcile before retry" : "SMTP did not accept recipient",
    availableAt: confirmationRetry(job.attempts + 1),
  } });
  return { processed: 1 };
}
