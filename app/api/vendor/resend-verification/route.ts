export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { consumeOrReject, createRegisterRateLimiter } from "@/lib/security/rate-limit";
import { vendorResendBodySchema } from "@/lib/vendor-auth-schemas";
import { sendVendorVerificationEmail } from "@/lib/vendor-mail";
import { clientIp } from "@/lib/vendor-ip";

const limiter = createRegisterRateLimiter();

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await consumeOrReject(
    limiter,
    `vendor-resend:${ip}`
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later.", retrySecs: limited.retrySecs },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = vendorResendBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = sanitizePlainText(parsed.data.email, 255).toLowerCase();
  const vendor = await prisma.vendor.findUnique({
    where: { email },
    select: { id: true, isEmailVerified: true, status: true },
  });

  if (!vendor) {
    return NextResponse.json({
      ok: true,
      message: "If an account exists for this email, a verification link was sent.",
    });
  }

  if (vendor.isEmailVerified) {
    return NextResponse.json({
      ok: true,
      message: "This email is already verified.",
    });
  }

  const emailVerifyToken = randomBytes(32).toString("hex");
  await prisma.vendor.update({
    where: { id: vendor.id },
    data: { emailVerifyToken },
  });

  try {
    await sendVendorVerificationEmail(email, emailVerifyToken);
  } catch (e) {
    console.error("resend verification", e);
    return NextResponse.json(
      { error: "Could not send email. Try again later." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Verification email sent. Check your inbox.",
  });
}
