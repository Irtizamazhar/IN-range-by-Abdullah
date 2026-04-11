import nodemailer from "nodemailer";
import { sanitizePlainText } from "@/lib/security/sanitize";

function createVendorTransport() {
  const host =
    process.env.EMAIL_HOST?.trim() ||
    process.env.SMTP_HOST?.trim() ||
    "smtp.gmail.com";
  const port = Number(
    process.env.EMAIL_PORT || process.env.SMTP_PORT || 587
  );
  const user =
    process.env.EMAIL_USER?.trim() || process.env.SMTP_USER?.trim();
  const pass =
    process.env.EMAIL_PASS?.trim() || process.env.SMTP_PASS?.trim();
  if (!user || !pass) {
    console.warn(
      "EMAIL_USER/EMAIL_PASS or SMTP_USER/SMTP_PASS not set — vendor emails will not send"
    );
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

function fromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    process.env.EMAIL_USER?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "noreply@inrange.pk"
  );
}

export function vendorAppBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  return base || "http://localhost:3000";
}

export async function sendVendorVerificationEmail(
  toRaw: string,
  verifyToken: string
): Promise<void> {
  const to = sanitizePlainText(toRaw, 320).toLowerCase();
  if (!to.includes("@")) return;
  const base = vendorAppBaseUrl();
  const url = `${base}/api/vendor/verify-email?token=${encodeURIComponent(verifyToken)}`;
  const transporter = createVendorTransport();
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Verify your vendor email — In Range",
    text: `Verify your vendor account by opening this link:\n${url}\n\nIf you did not register, ignore this email.`,
    html: `<p>Verify your vendor account by clicking below.</p><p><a href="${url}">Verify email</a></p><p style="color:#666;font-size:12px">If the button does not work, copy this URL:<br/>${url}</p>`,
  });
}

/** Sent when admin approves the vendor (same address as registration). */
export async function sendVendorApprovedEmail(
  toRaw: string,
  shopNameRaw: string
): Promise<void> {
  const to = sanitizePlainText(toRaw, 320).toLowerCase();
  if (!to.includes("@")) return;
  const shopName = sanitizePlainText(shopNameRaw, 200);
  const base = vendorAppBaseUrl();
  const loginUrl = `${base}/vendor/login`;
  const transporter = createVendorTransport();
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Your seller account is approved — In Range",
    text: `Good news — "${shopName}" has been approved on In Range.\n\nYou can sign in to your vendor dashboard here:\n${loginUrl}\n\n— In Range team`,
    html: `<p>Good news — <strong>${escapeHtml(shopName)}</strong> has been <strong>approved</strong> on In Range.</p><p><a href="${loginUrl}">Sign in to vendor dashboard</a></p><p style="color:#999;font-size:12px">— In Range</p>`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendVendorWithdrawalApprovedEmail(
  toRaw: string,
  amountPkr: number
): Promise<void> {
  const to = sanitizePlainText(toRaw, 320).toLowerCase();
  if (!to.includes("@")) return;
  const transporter = createVendorTransport();
  const amt = Math.round(amountPkr);
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Withdrawal approved — In Range",
    html: `<p>Your withdrawal request of <strong>Rs. ${amt.toLocaleString("en-PK")}</strong> has been <strong>approved</strong>. We will process the transfer shortly.</p><p>— In Range</p>`,
  });
}

export async function sendVendorWithdrawalPaidEmail(
  toRaw: string,
  amountPkr: number
): Promise<void> {
  const to = sanitizePlainText(toRaw, 320).toLowerCase();
  if (!to.includes("@")) return;
  const transporter = createVendorTransport();
  const amt = Math.round(amountPkr);
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Withdrawal transferred — In Range",
    html: `<p>Your withdrawal of <strong>Rs. ${amt.toLocaleString("en-PK")}</strong> has been <strong>transferred</strong> to your registered bank account.</p><p>— In Range</p>`,
  });
}

export async function sendVendorWithdrawalRejectedEmail(
  toRaw: string,
  amountPkr: number,
  reason: string
): Promise<void> {
  const to = sanitizePlainText(toRaw, 320).toLowerCase();
  if (!to.includes("@")) return;
  const transporter = createVendorTransport();
  const amt = Math.round(amountPkr);
  const r = escapeHtml(sanitizePlainText(reason, 2000));
  await transporter.sendMail({
    from: fromAddress(),
    to,
    subject: "Withdrawal request update — In Range",
    html: `<p>Your withdrawal request of <strong>Rs. ${amt.toLocaleString("en-PK")}</strong> could not be completed.</p><p><strong>Reason:</strong> ${r}</p><p>Your available balance remains unchanged.</p><p>— In Range</p>`,
  });
}
