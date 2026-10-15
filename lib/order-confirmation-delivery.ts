import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendMailOutcome } from "@/lib/mailer";
import { orderConfirmationEmail } from "@/lib/joro-email-templates";
import { orderConfirmationEligible, confirmationRetry } from "@/lib/order-confirmation-policy";

/** Called in the same transaction as the authoritative order/payment write. */
export async function queueOrderConfirmation(tx: Prisma.TransactionClient, order: { id: string; orderStatus: string; paymentMethod: string; paymentStatus: string }) {
  if (!orderConfirmationEligible(order)) return;
  await tx.orderConfirmationEmail.upsert({ where: { orderId: order.id }, create: { orderId: order.id }, update: {} });
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
  try {
    order = await db.order.findUnique({ where: { id: job.orderId }, include: { customer: true, orderItems: true } });
    if (order) email = orderConfirmationEmail(order);
  } catch {
    // No SMTP call has begun, so this failure can safely be retried.
    await db.orderConfirmationEmail.update({ where: { id: job.id }, data: { status: job.attempts + 1 >= 5 ? "failed" : "pending", availableAt: confirmationRetry(job.attempts + 1), lastError: "Could not load order or prepare template" } });
    return { processed: 1 };
  }
  if (!order || !orderConfirmationEligible(order) || !order.customer?.isActive) {
    await db.orderConfirmationEmail.update({ where: { id: job.id }, data: { status: "skipped", lastError: "Order or owner no longer eligible" } });
    return { processed: 1 };
  }
  // Customer auth currently has no local email-verification flag. Google verification
  // remains enforced by the existing OAuth flow. Never use checkout-supplied email.
  let outcome: "accepted" | "retry" | "uncertain";
  try { outcome = await send({ to: order.customer.email, ...email!, messageId: `<joro-order-confirmation-${job.id}@joro.pk>` }); }
  catch { outcome = "uncertain"; }
  await db.orderConfirmationEmail.update({ where: { id: job.id }, data: {
    status: outcome === "accepted" ? "accepted" : outcome === "uncertain" ? "uncertain" : job.attempts + 1 >= 5 ? "failed" : "pending",
    acceptedAt: outcome === "accepted" ? new Date() : null,
    lastError: outcome === "accepted" ? null : outcome === "uncertain" ? "SMTP outcome uncertain; reconcile before retry" : "SMTP did not accept recipient",
    availableAt: confirmationRetry(job.attempts + 1),
  } });
  return { processed: 1 };
}
