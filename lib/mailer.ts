import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.EMAIL_HOST?.trim() || process.env.SMTP_HOST?.trim();
  const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 465);
  const user = process.env.EMAIL_USER?.trim() || process.env.SMTP_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim() || process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Mail transport is not configured.");
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || (process.env.SMTP_SECURE !== "false" && port === 465),
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
}

export const JORO_SENDER = "JORO <admin@joro.pk>";

/** Check provider availability without sending a message or looking up an account. */
export async function verifyMailTransport(): Promise<boolean> {
  if (!isMailConfigured()) return false;
  const transport = createTransport();
  try { await transport.verify(); return true; }
  catch { return false; }
  finally { transport.close(); }
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  return (await sendMailOutcome(opts)) === "accepted";
}

/** An ambiguous DATA timeout must never be blindly retried: SMTP may have accepted it. */
export async function sendMailOutcome(opts: { to: string; subject: string; html: string; text?: string; messageId?: string }): Promise<"accepted" | "retry" | "uncertain"> {
  try {
    if (!isMailConfigured()) return "retry";
    const transporter = createTransport();
    const result = await transporter.sendMail({
      from: JORO_SENDER,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      messageId: opts.messageId,
    });
    return result.accepted.some(address => (typeof address === "string" ? address : address.address).toLowerCase() === opts.to.toLowerCase()) ? "accepted" : "retry";
  } catch (e) {
    console.error("sendMail failed", e instanceof Error ? e.name : "Unknown error");
    const error = e as { command?: string; responseCode?: number };
    return error.responseCode || ["CONN", "EHLO", "HELO", "AUTH", "AUTH PLAIN", "AUTH LOGIN", "MAIL FROM", "RCPT TO"].includes(error.command || "") ? "retry" : "uncertain";
  }
}

export function isMailConfigured(): boolean {
  const user = process.env.EMAIL_USER?.trim() || process.env.SMTP_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim() || process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim();
  const host = process.env.EMAIL_HOST?.trim() || process.env.SMTP_HOST?.trim();
  const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 465);
  return Boolean(host && user && pass && Number.isInteger(port) && port > 0 && port <= 65535);
}

export function getAdminEmail(): string {
  return process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || process.env.ADMIN_EMAIL?.trim() || "";
}
