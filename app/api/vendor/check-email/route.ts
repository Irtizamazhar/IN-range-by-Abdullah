export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { consumeOrReject, createApiRateLimiter } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/vendor-ip";

const limiter = createApiRateLimiter();

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await consumeOrReject(limiter, `vendor-check-email:${ip}`);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retrySecs: limited.retrySecs },
      { status: 429 }
    );
  }

  const emailRaw = req.nextUrl.searchParams.get("email") || "";
  const email = sanitizePlainText(emailRaw, 255).toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ available: false, invalid: true });
  }

  const existing = await prisma.vendor.findUnique({
    where: { email },
    select: { id: true },
  });

  return NextResponse.json({ available: !existing });
}
