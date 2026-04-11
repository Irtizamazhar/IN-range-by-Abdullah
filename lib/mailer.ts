import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.warn("SMTP_USER/SMTP_PASS not set — emails will not send");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@inrange.pk";

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  try {
    const transporter = createTransport();
    await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
  } catch (e) {
    console.error("sendMail error", e);
  }
}

export function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL || "admin@inrange.pk";
}
