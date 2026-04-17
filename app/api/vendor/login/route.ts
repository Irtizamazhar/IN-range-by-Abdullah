export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { consumeOrReject, createLoginRateLimiter } from "@/lib/security/rate-limit";
import { vendorLoginBodySchema } from "@/lib/vendor-auth-schemas";
import { signVendorJwt } from "@/lib/vendor-jwt";
import {
  defaultVendorJwtExpiresIn,
  vendorJwtExpiresSeconds,
} from "@/lib/vendor-expires";
import { hashVendorJwtCookie } from "@/lib/vendor-token-hash";
import { VENDOR_JWT_COOKIE } from "@/lib/vendor-cookies";
import { clientIp } from "@/lib/vendor-ip";
import { randomBytes } from "crypto";
import { resolveVendorJwtSecretKey } from "@/lib/vendor-jwt-secret";
import { vendorEmailVerificationRequired } from "@/lib/vendor-email-verification-flag";

const loginLimiter = createLoginRateLimiter();

function cookieBase() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure,
  };
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await consumeOrReject(loginLimiter, `vendor-login:${ip}`);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later.", retrySecs: limited.retrySecs },
      { status: 429 }
    );
  }

  if (!resolveVendorJwtSecretKey()) {
    return NextResponse.json(
      {
        error:
          "Vendor login is not configured. Set VENDOR_JWT_SECRET in your environment (required in production).",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = vendorLoginBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }

  const email = sanitizePlainText(parsed.data.email, 255).toLowerCase();
  const ua = req.headers.get("user-agent")?.slice(0, 2000) ?? null;

  const vendor = await prisma.vendor.findUnique({ where: { email } });
  if (!vendor) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (vendor.lockedUntil && vendor.lockedUntil > new Date()) {
    return NextResponse.json(
      { error: "Account temporarily locked. Try again later." },
      { status: 423 }
    );
  }

  const submittedPassword = parsed.data.password;
  let ok = await bcrypt.compare(submittedPassword, vendor.passwordHash);
  if (!ok) {
    ok = await bcrypt.compare(submittedPassword.trim(), vendor.passwordHash);
  }
  if (!ok) {
    const attempts = vendor.loginAttempts + 1;
    const lock =
      attempts >= 5
        ? { lockedUntil: new Date(Date.now() + 30 * 60 * 1000), loginAttempts: 0 }
        : { loginAttempts: attempts, lockedUntil: null as Date | null };
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: lock,
    });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  /** Fresh row: admin may have approved while this form was open (avoids stale `pending`). */
  const live = await prisma.vendor.findUnique({ where: { id: vendor.id } });
  if (!live) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Strict mode only when transactional email is enabled (see VENDOR_REQUIRE_EMAIL_VERIFICATION).
  if (
    vendorEmailVerificationRequired() &&
    !live.isEmailVerified &&
    live.status !== "approved"
  ) {
    return NextResponse.json(
      {
        code: "unverified",
        error:
          "Please verify your email before signing in. Check your inbox or resend the verification link.",
      },
      { status: 403 }
    );
  }

  if (live.status === "pending") {
    return NextResponse.json(
      { code: "pending", error: "Application under review" },
      { status: 403 }
    );
  }

  if (live.status === "rejected") {
    return NextResponse.json(
      {
        code: "rejected",
        error: live.rejectionReason?.trim() || "Your application was not approved.",
      },
      { status: 403 }
    );
  }

  if (live.status === "suspended") {
    return NextResponse.json(
      { code: "suspended", error: "Account suspended" },
      { status: 403 }
    );
  }

  await prisma.vendor.update({
    where: { id: live.id },
    data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const rememberMe = parsed.data.rememberMe;
  const expiresIn = rememberMe ? "30d" : defaultVendorJwtExpiresIn();
  const maxAge = vendorJwtExpiresSeconds(expiresIn);
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  const sessionId = `vs_${randomBytes(18).toString("hex")}`;

  const jwt = await signVendorJwt(live.id, sessionId, expiresIn);
  const tokenHash = hashVendorJwtCookie(jwt);

  await prisma.$transaction([
    prisma.vendorSession.create({
      data: {
        id: sessionId,
        vendorId: live.id,
        tokenHash,
        ipAddress: ip,
        userAgent: ua,
        expiresAt,
      },
    }),
    prisma.vendorAuditLog.create({
      data: {
        vendorId: live.id,
        action: "login",
        ipAddress: ip,
        userAgent: ua,
        details: { rememberMe },
      },
    }),
  ]);

  const res = NextResponse.json({
    ok: true,
    message: "Signed in",
    vendor: {
      id: live.id,
      shopName: live.shopName,
      ownerName: live.ownerName,
      email: live.email,
      status: live.status,
    },
  });
  res.cookies.set(VENDOR_JWT_COOKIE, jwt, {
    ...cookieBase(),
    maxAge,
  });
  return res;
}
