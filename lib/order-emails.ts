import { sendMail, getAdminEmail } from "@/lib/mailer";
import type { OrderNotifyPayload } from "@/types/order-notify";

export async function notifyAdminNewOrder(order: OrderNotifyPayload) {
  try {
    await sendMail({
      to: getAdminEmail(),
      subject: `New order ${order.orderNumber}`,
      html: `<p>New order <strong>${order.orderNumber}</strong> from ${order.customerName} — ${order.totalAmount} PKR</p>`,
    });
  } catch (e) {
    // Email failures should never break order placement.
    console.error("notifyAdminNewOrder", e);
  }
}

export async function notifyAdminOrderCancelled(order: OrderNotifyPayload) {
  try {
    await sendMail({
      to: getAdminEmail(),
      subject: `Order cancelled ${order.orderNumber}`,
      html: `<p>Order <strong>${order.orderNumber}</strong> was cancelled by customer.</p>`,
    });
  } catch (e) {
    console.error("notifyAdminOrderCancelled", e);
  }
}

export async function notifyAdminScreenshotUploaded(order: OrderNotifyPayload) {
  try {
    await sendMail({
      to: getAdminEmail(),
      subject: `Payment screenshot uploaded ${order.orderNumber}`,
      html: `<p>Customer uploaded payment proof for <strong>${order.orderNumber}</strong>.</p>`,
    });
  } catch (e) {
    console.error("notifyAdminScreenshotUploaded", e);
  }
}

export async function notifyCustomerOrderConfirmed(order: OrderNotifyPayload) {
  try {
    await sendMail({
      to: order.customerEmail,
      subject: `Order confirmed — ${order.orderNumber}`,
      html: `<p>Assalam-o-Alaikum ${order.customerName},</p><p>Your order <strong>${order.orderNumber}</strong> is confirmed.</p>`,
    });
  } catch (e) {
    console.error("notifyCustomerOrderConfirmed", e);
  }
}

export async function notifyCustomerShipped(order: OrderNotifyPayload) {
  try {
    const slice =
      order.shopOrderNumber && order.shopOrderNumber !== order.orderNumber
        ? `<p>Seller reference: <strong>${order.shopOrderNumber}</strong></p>`
        : "";
    await sendMail({
      to: order.customerEmail,
      subject: `Order shipped — ${order.orderNumber}`,
      html: `<p>Your order <strong>${order.orderNumber}</strong> has been shipped.</p>${slice}<p>Tracking: ${order.trackingNumber || "N/A"}</p>`,
    });
  } catch (e) {
    console.error("notifyCustomerShipped", e);
  }
}

export async function notifyCustomerDelivered(order: OrderNotifyPayload) {
  try {
    await sendMail({
      to: order.customerEmail,
      subject: `Order delivered — ${order.orderNumber}`,
      html: `<p>Assalam-o-Alaikum ${order.customerName},</p><p>Your order <strong>${order.orderNumber}</strong> has been marked <strong>delivered</strong>. Thank you for shopping with us.</p>`,
    });
  } catch (e) {
    console.error("notifyCustomerDelivered", e);
  }
}

export async function notifyCustomerPaymentRejected(
  order: OrderNotifyPayload,
  reason: string
) {
  try {
    await sendMail({
      to: order.customerEmail,
      subject: `Payment issue — ${order.orderNumber}`,
      html: `<p>Payment for order <strong>${order.orderNumber}</strong> could not be verified.</p><p>Reason: ${reason}</p>`,
    });
  } catch (e) {
    console.error("notifyCustomerPaymentRejected", e);
  }
}

export async function notifyCustomerOrderCancelled(order: OrderNotifyPayload) {
  try {
    await sendMail({
      to: order.customerEmail,
      subject: `Order cancelled — ${order.orderNumber}`,
      html: `<p>Your order <strong>${order.orderNumber}</strong> has been cancelled.</p>`,
    });
  } catch (e) {
    console.error("notifyCustomerOrderCancelled", e);
  }
}
