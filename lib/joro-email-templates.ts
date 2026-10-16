import { appOrigin } from "@/lib/app-url";
import { sanitizeDescriptionHtml } from "@/lib/security/sanitize";

export type JoroEmail = { subject: string; html: string; text: string };

export function orderConfirmationEmail(order: {
  id: string; orderNumber: string; customerName: string; createdAt: Date;
  customerAddress: string; city: string; paymentMethod: string; paymentStatus: string;
  totalAmount: unknown; orderItems: { name: string; quantity: number; price: unknown }[];
}): JoroEmail {
  const money = (value: unknown) => `PKR ${Number(value).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const lines = order.orderItems.map(item => `${item.name} × ${item.quantity} — ${money(item.price)} each; ${money(Number(item.price) * item.quantity)}`);
  const details = [
    `Order: ${order.orderNumber}`,
    `Date: ${order.createdAt.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", year: "numeric", month: "long", day: "numeric" })}`,
    ...lines, `Order total: ${money(order.totalAmount)}`,
    `Payment method: ${order.paymentMethod === "cod" ? "Cash on delivery" : "Bank transfer"}`,
    `Payment status: ${order.paymentStatus}${order.paymentMethod === "cod" && order.paymentStatus === "pending" ? " (due on delivery)" : ""}`,
    ...([order.customerAddress, order.city].some(Boolean) ? [`Delivery: ${[order.customerAddress, order.city].filter(Boolean).join(", ")}`] : []),
    ...(process.env.SUPPORT_EMAIL?.trim() ? [`Support: ${process.env.SUPPORT_EMAIL.trim()}`] : []),
  ];
  return brand({ subject: `Order confirmed — ${order.orderNumber}`, preview: "Thank you for your order at JORO", greeting: `Assalam-o-Alaikum ${order.customerName},`,
    bodyHtml: `<p>Your order is confirmed. Thank you for shopping with JORO.</p>${details.map(line => `<p style="overflow-wrap:anywhere;margin:10px 0">${escapeEmailHtml(line)}</p>`).join("")}`,
    bodyText: `Your order is confirmed.\n${details.join("\n")}`, action: { label: "View Order", url: `${appOrigin()}/account/orders/${encodeURIComponent(order.id)}` }, footer: "This is a transactional order confirmation from JORO." });
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
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f8f7;font-family:Arial,Helvetica,sans-serif;color:#123536"><span style="display:none!important;max-height:0;overflow:hidden;opacity:0">${escapeEmailHtml(preview)}</span><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f8f7"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:18px;overflow:hidden"><tr><td align="center" style="padding:28px 24px 16px;border-top:6px solid #005055"><img src="https://joro.pk/logo.png" width="150" alt="JORO" style="display:block;width:150px;max-width:100%;height:auto"><p style="margin:4px 0;color:#4b7b37;font-size:14px;font-weight:700">Jo Chahiye, Yahin Mile!</p></td></tr><tr><td style="padding:12px 32px 32px;font-size:16px;line-height:1.65"><h1 style="margin:0 0 18px;color:#005055;font-size:25px;line-height:1.25">${escapeEmailHtml(subject)}</h1><p style="margin:0 0 16px">${escapeEmailHtml(greeting)}</p>${bodyHtml}${actionHtml}<p style="margin:22px 0 0;color:#526869;font-size:13px">${escapeEmailHtml(footerText)}</p></td></tr><tr><td align="center" style="padding:20px;background:#e9f4ee;color:#526869;font-size:12px">JORO.pk · <a href="${origin}" style="color:#005055">joro.pk</a></td></tr></table></td></tr></table></body></html>`,
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
