import {appOrigin} from "@/lib/app-url";
export const dynamic = "force-dynamic";

import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMailConfigured, sendMail } from "@/lib/mailer";
import { consumeOrReject, createLoginRateLimiter } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/vendor-ip";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const limiter = createLoginRateLimiter();

export async function POST(req: NextRequest) {
  const limited = await consumeOrReject(limiter, `customer-reset:${clientIp(req)}`);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many reset requests. Try again later.", retrySecs: limited.retrySecs },
      { status: 429 }
    );
  }
  if (!isMailConfigured()) {
    return NextResponse.json(
      { error: "Password reset email is not configured. Please contact support." },
      { status: 503 }
    );
  }

  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email = String(body.email || "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const generic = {
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
  };
  const customer = await prisma.customer.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  if (!customer) return NextResponse.json(generic);

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.$transaction([
    prisma.customerPasswordResetToken.deleteMany({
      where: { customerId: customer.id, usedAt: null },
    }),
    prisma.customerPasswordResetToken.create({
      data: {
        customerId: customer.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    }),
  ]);

  const base = appOrigin();
  const url = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const sent = await sendMail({
    to: customer.email,
    subject: "Set or reset your In Range password",
    text: `Open this link within 30 minutes to set or reset your website password:\n${url}`,
    html: `<p>Hello ${customer.name.replace(/[<>&"']/g, "")},</p><p>Use the link below within 30 minutes to set or reset your website password.</p><p><a href="${url}">Set or reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
  if (!sent) {
    await prisma.customerPasswordResetToken.deleteMany({ where: { tokenHash } });
    return NextResponse.json(
      { error: "Reset email could not be sent. Please try again later." },
      { status: 502 }
    );
  }
  return NextResponse.json(generic);
}
