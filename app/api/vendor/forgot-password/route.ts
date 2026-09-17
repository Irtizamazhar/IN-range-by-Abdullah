export const dynamic = "force-dynamic";

import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeOrReject, createLoginRateLimiter } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/vendor-ip";
import { sendVendorPasswordResetEmail, vendorMailConfigured } from "@/lib/vendor-mail";

const schema = z.object({ email: z.string().email().max(255) });
const limiter = createLoginRateLimiter();

export async function POST(req: NextRequest) {
  const limited = await consumeOrReject(limiter, `vendor-reset:${clientIp(req)}`);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many reset requests. Try again later." }, { status: 429 });
  }
  if (!vendorMailConfigured()) {
    return NextResponse.json(
      { error: "Password reset email is not configured. Please contact support." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });

  const generic = {
    ok: true,
    message: "If a seller account exists for that email, a reset link has been sent.",
  };
  const email = parsed.data.email.trim().toLowerCase();
  const vendor = await prisma.vendor.findUnique({ where: { email }, select: { id: true } });
  if (!vendor) return NextResponse.json(generic);

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  await prisma.vendor.update({
    where: { id: vendor.id },
    data: {
      passwordResetToken: tokenHash,
      passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  try {
    await sendVendorPasswordResetEmail(email, rawToken);
  } catch (error) {
    console.error("vendor password reset email", error);
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { passwordResetToken: null, passwordResetExpires: null },
    });
    return NextResponse.json({ error: "Reset email could not be sent" }, { status: 502 });
  }
  return NextResponse.json(generic);
}
