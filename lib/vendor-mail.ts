import { appOrigin } from "@/lib/app-url";
import { isMailConfigured, sendMail } from "@/lib/mailer";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { vendorApprovalEmail, vendorPasswordResetEmail, vendorVerificationEmail, vendorRejectionEmail, type JoroEmail } from "@/lib/joro-email-templates";

export function vendorAppBaseUrl(): string { return appOrigin(); }
export function vendorMailConfigured(): boolean { return isMailConfigured(); }

async function deliver(toRaw: string, email: JoroEmail): Promise<void> {
  const to = sanitizePlainText(toRaw, 320).toLowerCase();
  if (!to.includes("@") || !await sendMail({ to, ...email })) {
    throw new Error("Seller email was not accepted by the mail provider.");
  }
}

export async function sendVendorPasswordResetEmail(to: string, token: string): Promise<void> {
  await deliver(to, vendorPasswordResetEmail(`${appOrigin()}/vendor/reset-password?token=${encodeURIComponent(token)}`));
}

export async function sendVendorVerificationEmail(to: string, token: string): Promise<void> {
  await deliver(to, vendorVerificationEmail(`${appOrigin()}/api/vendor/verify-email?token=${encodeURIComponent(token)}`));
}

export async function sendVendorApprovedEmail(to: string, shopName: string): Promise<void> {
  await deliver(to, vendorApprovalEmail(sanitizePlainText(shopName, 200)));
}

export async function sendVendorRejectedEmail(to: string, reason: string): Promise<void> {
  await deliver(to, vendorRejectionEmail(sanitizePlainText(reason, 2000)));
}

export async function sendVendorWithdrawalApprovedEmail(to: string, amountPkr: number): Promise<void> {
  const amount = Math.round(amountPkr).toLocaleString("en-PK");
  await deliver(to, { subject: "JORO withdrawal approved", text: `Your withdrawal request of Rs. ${amount} was approved. We will process the transfer shortly.`, html: `<p>Your withdrawal request of <strong>Rs. ${amount}</strong> was approved. We will process the transfer shortly.</p>` });
}

export async function sendVendorWithdrawalPaidEmail(to: string, amountPkr: number): Promise<void> {
  const amount = Math.round(amountPkr).toLocaleString("en-PK");
  await deliver(to, { subject: "JORO withdrawal transferred", text: `Your withdrawal of Rs. ${amount} was transferred to your registered bank account.`, html: `<p>Your withdrawal of <strong>Rs. ${amount}</strong> was transferred to your registered bank account.</p>` });
}

export async function sendVendorWithdrawalRejectedEmail(to: string, amountPkr: number, reason: string): Promise<void> {
  const amount = Math.round(amountPkr).toLocaleString("en-PK");
  const safeReason = sanitizePlainText(reason, 2000);
  const escapedReason = safeReason.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  await deliver(to, { subject: "JORO withdrawal request update", text: `Your withdrawal request of Rs. ${amount} could not be completed. Reason: ${safeReason}. Your available balance remains unchanged.`, html: `<p>Your withdrawal request of <strong>Rs. ${amount}</strong> could not be completed.</p><p><strong>Reason:</strong> ${escapedReason}</p><p>Your available balance remains unchanged.</p>` });
}
