import { appOrigin } from "@/lib/app-url";
import { sanitizeDescriptionHtml } from "@/lib/security/sanitize";
import { storedOrderBreakdown } from "@/lib/stored-order-breakdown";

export type JoroEmail = { subject: string; html: string; text: string };

type EmailItem = { name: string; quantity: number; price: unknown; image?: string | null; subtotal?: unknown };
type ConfirmedEmailOrder = {
  id: string; orderNumber: string; customerName: string; createdAt: Date;
  customerAddress: string; city: string; paymentMethod: string; paymentStatus: string;
  totalAmount: unknown; handlingFee?: unknown; orderItems: EmailItem[];
  couponRedemption?: { discount: unknown } | null;
  services?: { quantity: number; price: unknown }[];
};
const emailMoney = (value: unknown) => `PKR ${Number(value).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const emailDate = (date: Date) => date.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", year: "numeric", month: "long", day: "numeric" });
function emailImage(value?: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value, appOrigin()); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function emailItems(items: EmailItem[]) {
  return {
    html: items.map(item => {
      const image = emailImage(item.image);
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #dfede5;margin:12px 0"><tr><td style="padding:12px 0;overflow-wrap:anywhere">${image ? `<img src="${escapeEmailHtml(image)}" width="64" alt="${escapeEmailHtml(item.name)}" style="display:block;width:64px;max-width:100%;height:auto;margin-bottom:8px">` : ""}<strong>${escapeEmailHtml(item.name)}</strong><br>Quantity: ${item.quantity}<br>Unit price: ${emailMoney(item.price)}<br>Item amount: ${emailMoney(item.subtotal ?? Number(item.price) * item.quantity)}</td></tr></table>`;
    }).join(""),
    text: items.map(item => `${item.name} x ${item.quantity} - ${emailMoney(item.price)} each; ${emailMoney(item.subtotal ?? Number(item.price) * item.quantity)}`).join("\n"),
  };
}
function paymentDetails(order: { paymentMethod: string; paymentStatus: string }) {
  return [`Payment method: ${order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod === "bank_transfer" ? "Bank transfer" : order.paymentMethod}`, `Payment status: ${order.paymentStatus}${order.paymentMethod === "cod" && order.paymentStatus === "pending" ? " (due on delivery)" : ""}`];
}
const detailHtml = (details: string[]) => details.map(line => `<p style="overflow-wrap:anywhere;margin:10px 0">${escapeEmailHtml(line)}</p>`).join("");
const orderClosing = "Thank you for choosing JORO.\nJo Chahiye, Yahin Mile!\nJORO Support";

export function orderConfirmationEmail(order: ConfirmedEmailOrder): JoroEmail {
  const items = emailItems(order.orderItems);
  const { productSubtotal, serviceSubtotal, discount, handlingFee, delivery, total } = storedOrderBreakdown(order);
  const details = [`Order Number: ${order.orderNumber}`, `Order Date: ${emailDate(order.createdAt)}`, `Subtotal: ${emailMoney(productSubtotal)}`, ...(serviceSubtotal ? [`Booked services: ${emailMoney(serviceSubtotal)}`] : []), ...(discount ? [`Discount: ${emailMoney(discount)}`] : []), ...(handlingFee > 0 ? [`Handling Fee: ${emailMoney(handlingFee)}`] : []), ...(delivery > 0 ? [`Delivery Charges: ${emailMoney(delivery)}${handlingFee === 0 ? " (includes applicable fulfilment and handling)" : ""}`] : []), `Final Order Total: ${emailMoney(total)}`, ...paymentDetails(order), `Delivery Address: ${[order.customerAddress, order.city].filter(Boolean).join(", ")}`];
  return brand({ subject: `JORO | Order Confirmed - #${order.orderNumber}`, preview: "Thank you for shopping with JORO!", greeting: `Hello ${order.customerName},`, bodyHtml: `<p>Thank you for shopping with JORO!</p><p>Your order has been confirmed successfully.</p><h2 style="font-size:19px">Order details</h2>${items.html}${detailHtml(details)}`, bodyText: `Thank you for shopping with JORO!\nYour order has been confirmed successfully.\n${items.text}\n${details.join("\n")}`, action: { label: "Track Your Order", url: `${appOrigin()}/account/orders/${encodeURIComponent(order.id)}` }, footer: orderClosing });
}

export function sellerShippedEmail(input: { orderId: string; orderNumber: string; shopOrderNumber: string; customerName: string; trackingNumber: string }): JoroEmail {
  const detail = `Seller order ${input.shopOrderNumber} has been handed to the courier. Tracking: ${input.trackingNumber}.`;
  return brand({ subject: `JORO | Seller Order Shipped - #${input.shopOrderNumber}`, preview: detail, greeting: `Hello ${input.customerName},`, bodyHtml: detailHtml([detail]), bodyText: detail, action: { label: "Track Your Order", url: `${appOrigin()}/account/orders/${encodeURIComponent(input.orderId)}` }, footer: orderClosing });
}

export function vendorOrderEmail(order: Pick<ConfirmedEmailOrder, "orderNumber" | "paymentMethod" | "paymentStatus">, shop: {
  id: string; placedAt: Date; items: unknown; totalAmount: unknown;
  customerName: string; customerPhone: string; customerAddress: string; city: string;
  vendor: { shopName: string; ownerName: string };
}): JoroEmail {
  if (!Array.isArray(shop.items) || !shop.items.length) throw new Error("Vendor item snapshot missing");
  const items = emailItems(shop.items.map(value => {
    const item = value as Record<string, unknown>;
    if (!item || typeof item.productName !== "string" || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || !Number.isFinite(Number(item.price)) || !Number.isFinite(Number(item.subtotal))) throw new Error("Invalid vendor item snapshot");
    return { name: item.productName, quantity: Number(item.quantity), price: item.price, subtotal: item.subtotal, image: typeof item.image === "string" ? item.image : null };
  }));
  const details = [`Order Number: ${order.orderNumber}`, `Order Date: ${emailDate(shop.placedAt)}`, `Your items amount: ${emailMoney(shop.totalAmount)}`, ...paymentDetails(order), `Fulfillment recipient: ${shop.customerName}`, `Delivery Address: ${[shop.customerAddress, shop.city].filter(Boolean).join(", ")}`, `Fulfillment phone: ${shop.customerPhone}`];
  return brand({ subject: `JORO | New Order Received - #${order.orderNumber}`, preview: "You have received a new order on JORO.", greeting: `Hello ${shop.vendor.shopName || shop.vendor.ownerName},`, bodyHtml: `<p>You have received a new order on JORO.</p><p>Please review the order details and prepare it for processing.</p><h2 style="font-size:19px">Your order items</h2>${items.html}${detailHtml(details)}<p>Review the order in your dashboard for fulfillment instructions and current status. Item amounts reflect applicable seller-funded discounts.</p>`, bodyText: `You have received a new order on JORO.\nPlease review the order details and prepare it for processing.\n${items.text}\n${details.join("\n")}\nReview the order in your dashboard for fulfillment instructions and current status. Item amounts reflect applicable seller-funded discounts.`, action: { label: "View Order", url: `${appOrigin()}/vendor/dashboard/orders/${encodeURIComponent(shop.id)}` }, footer: orderClosing });
}

export function escapeEmailHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function brand({ subject, preview, greeting, bodyHtml, bodyText, action, footer }: {
  subject: string; preview: string; greeting: string; bodyHtml: string; bodyText: string;
  action?: { label: string; url: string }; footer?: string;
}): JoroEmail {
  const origin = appOrigin();
  const actionHtml = action ? `<p style="margin:28px 0"><a href="${escapeEmailHtml(action.url)}" style="display:inline-block;background:#005055;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">${escapeEmailHtml(action.label)}</a></p>` : "";
  const actionText = action ? `\n${action.label}: ${action.url}\n` : "";
  const footerText = footer || "If you did not expect this email, you can ignore it.";
  return {
    subject,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f8f7;font-family:Arial,Helvetica,sans-serif;color:#123536"><span style="display:none!important;max-height:0;overflow:hidden;opacity:0">${escapeEmailHtml(preview)}</span><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f8f7"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden"><tr><td align="center" style="padding:28px 24px 16px;border-top:6px solid #005055"><img src="https://joro.pk/logo.png" width="150" alt="JORO" style="display:block;width:150px;max-width:100%;height:auto"><p style="margin:4px 0;color:#4b7b37;font-size:14px;font-weight:700">Jo Chahiye, Yahin Mile!</p></td></tr><tr><td style="padding:12px 32px 32px;font-size:16px;line-height:1.65"><h1 style="margin:0 0 18px;color:#005055;font-size:25px;line-height:1.25">${escapeEmailHtml(subject)}</h1><p style="margin:0 0 16px">${escapeEmailHtml(greeting)}</p>${bodyHtml}${actionHtml}<p style="margin:22px 0 0;color:#526869;font-size:13px">${escapeEmailHtml(footerText).replace(/\n/g, "<br>")}</p></td></tr><tr><td align="center" style="padding:20px;background:#e9f4ee;color:#526869;font-size:12px">JORO.pk · <a href="${origin}" style="color:#005055">joro.pk</a></td></tr></table></td></tr></table></body></html>`,
    text: `${subject}\n\n${greeting}\n\n${bodyText}${actionText}\n${footerText}\n\nJORO.pk — ${origin}`,
  };
}

export function customerWelcomeEmail(name: string): JoroEmail {
  return brand({ subject: "Welcome to JORO! Your Journey Starts Here", preview: "Start exploring JORO.pk", greeting: `Hello ${name},`, bodyHtml: "<p>Welcome to JORO, your marketplace for discovering products and connecting with sellers. We’re glad you’re here.</p>", bodyText: "Welcome to JORO, your marketplace for discovering products and connecting with sellers. We’re glad you’re here.\n", action: { label: "Start Exploring", url: appOrigin() } });
}

export function customerVerificationEmail(name: string, url: string): JoroEmail {
  return brand({ subject: "Verify your JORO email", preview: "Confirm your email address", greeting: `Hello ${name},`, bodyHtml: "<p>Please verify your email address to continue.</p>", bodyText: "Please verify your email address to continue.\n", action: { label: "Verify Email", url } });
}

export function customerPasswordResetEmail(name: string, url: string): JoroEmail {
  return brand({ subject: "Reset your JORO password", preview: "Your password reset link", greeting: `Hello ${name},`, bodyHtml: "<p>Use the link below within 30 minutes to set or reset your password.</p>", bodyText: "Use the link below within 30 minutes to set or reset your password.\n", action: { label: "Reset Password", url } });
}

export function customerPasswordOtpEmail(code: string): JoroEmail {
  if (!/^\d{6}$/.test(code)) throw new Error("Invalid password verification code");
  return brand({
    subject: "JORO | Password Reset Verification Code",
    preview: "Your password reset verification code expires in 10 minutes.",
    greeting: "Hello,",
    bodyHtml: `<h2 style="font-size:20px;color:#005055">Password Reset Request</h2><p>We received a request to reset your JORO account password.</p><p>Use the verification code below to continue:</p><p style="text-align:center;font-size:34px;font-weight:700;letter-spacing:8px;background:#edf8ea;color:#005055;padding:20px 8px;border-radius:12px">${escapeEmailHtml(code)}</p><p>This code expires in 10 minutes.</p><p>If you didn't request this password reset, you can safely ignore this email.</p><p>For your security, never share this code.</p>`,
    bodyText: `Password Reset Request\n\nWe received a request to reset your JORO account password.\nUse the verification code below to continue:\n\n${code}\n\nThis code expires in 10 minutes.\nIf you didn't request this password reset, you can safely ignore this email.\nFor your security, never share this code.\n`,
    footer: "Regards,\nTeam JORO\nPakistan ka Apna Marketplace",
  });
}

export function passwordChangedEmail(name: string): JoroEmail {
  return brand({ subject: "Your JORO password was changed", preview: "Account security update", greeting: `Hello ${name},`, bodyHtml: "<p>Your account password was changed. If this was not you, contact JORO support immediately.</p>", bodyText: "Your account password was changed. If this was not you, contact JORO support immediately.\n" });
}

export function vendorWelcomeEmail(name: string): JoroEmail {
  return brand({ subject: "Welcome to JORO! Your Journey Starts Here", preview: "Continue setting up your seller account", greeting: `Hello ${name},`, bodyHtml: "<p>Welcome to JORO. Complete your seller setup to submit your store for review.</p>", bodyText: "Welcome to JORO. Complete your seller setup to submit your store for review.\n", action: { label: "Continue Setup", url: `${appOrigin()}/vendor/onboarding` } });
}

export function vendorVerificationEmail(url: string): JoroEmail {
  return brand({ subject: "Verify your JORO seller email", preview: "Confirm your seller email", greeting: "Hello seller,", bodyHtml: "<p>Verify your email address to continue with your JORO seller account.</p>", bodyText: "Verify your email address to continue with your JORO seller account.\n", action: { label: "Verify Email", url } });
}

export function vendorPasswordResetEmail(url: string): JoroEmail {
  return brand({ subject: "Reset your JORO seller password", preview: "Your seller password reset link", greeting: "Hello seller,", bodyHtml: "<p>Use the link below within 30 minutes to reset your seller password.</p>", bodyText: "Use the link below within 30 minutes to reset your seller password.\n", action: { label: "Reset Seller Password", url } });
}

export function vendorApprovalEmail(shopName: string): JoroEmail {
  const shop = escapeEmailHtml(shopName);
  return brand({ subject: "Your JORO seller account is approved", preview: "Your store can start selling", greeting: "Hello seller,", bodyHtml: `<p>Good news — <strong>${shop}</strong> has been approved on JORO.</p>`, bodyText: `Good news — ${shopName} has been approved on JORO.\n`, action: { label: "Open Seller Dashboard", url: `${appOrigin()}/vendor/dashboard` } });
}

export function vendorRejectionEmail(reason: string): JoroEmail {
  return brand({ subject: "Update on your JORO seller application", preview: "Review your seller application", greeting: "Hello seller,", bodyHtml: `<p>Your seller application needs an update before approval.</p><p><strong>Reason:</strong> ${escapeEmailHtml(reason)}</p>`, bodyText: `Your seller application needs an update before approval.\nReason: ${reason}\n`, action: { label: "Review Application", url: `${appOrigin()}/vendor/onboarding` } });
}

export function campaignEmail(subject: string, preview: string, bodyHtml: string, unsubscribeUrl?: string): JoroEmail {
  const safeHtml = sanitizeDescriptionHtml(bodyHtml, 20000);
  const text = safeHtml.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return brand({ subject, preview, greeting: "Hello,", bodyHtml: safeHtml, bodyText: text, footer: unsubscribeUrl ? `Marketing email. Unsubscribe: ${unsubscribeUrl}` : "Campaign preview sent only to a JORO administrator." });
}
