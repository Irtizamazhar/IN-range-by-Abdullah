import {appOrigin} from "@/lib/app-url";
import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.EMAIL_HOST?.trim() || process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 587);
  const user = process.env.EMAIL_USER?.trim() || process.env.SMTP_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim() || process.env.SMTP_PASS?.trim();
  if (!user || !pass) {
    console.warn("EMAIL_USER/EMAIL_PASS or SMTP_USER/SMTP_PASS not set — emails will not send");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

function fromAddress() {
  return process.env.EMAIL_FROM?.trim() || process.env.SMTP_FROM?.trim() || process.env.EMAIL_USER?.trim() || process.env.SMTP_USER?.trim() || ("noreply@" + new URL(appOrigin()).hostname);
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  try {
    if (!isMailConfigured()) return false;
    const transporter = createTransport();
    await transporter.sendMail({
      from: fromAddress(),
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (e) {
    console.error("sendMail error", e);
    return false;
  }
}

export function isMailConfigured(): boolean {
  const user = process.env.EMAIL_USER?.trim() || process.env.SMTP_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim() || process.env.SMTP_PASS?.trim();
  return Boolean(user && pass);
}

export function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL || "";
}
