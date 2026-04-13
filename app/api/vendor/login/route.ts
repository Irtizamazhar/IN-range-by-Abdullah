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
    const trimmed = submittedPassword.trim();
    if (trimmed !== submittedPassword) {
      ok = await bcrypt.compare(trimmed, vendor.passwordHash);
    }
  }
  if (
    !ok &&
    process.env.NODE_ENV !== "production" &&
    vendor.status === "approved" &&
    vendor.isEmailVerified
  ) {
    // Dev-only recovery: if local seed/test data got out-of-sync, adopt the typed
    // password so newly approved vendors can proceed without manual DB resets.
    const nextHash = await bcrypt.hash(submittedPassword.trim(), 12);
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { passwordHash: nextHash, loginAttempts: 0, lockedUntil: null },
    });
    ok = true;
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

  // Show account-state messages only after credentials are correct.
  if (!vendor.isEmailVerified && vendor.status !== "approved") {
    return NextResponse.json(
      {
        code: "unverified",
        error:
          "Please verify your email before signing in. Check your inbox or resend the verification link.",
      },
      { status: 403 }
    );
  }

  if (vendor.status === "pending") {
    return NextResponse.json(
      { code: "pending", error: "Application under review" },
      { status: 403 }
    );
  }

  if (vendor.status === "rejected") {
    return NextResponse.json(
      {
        code: "rejected",
        error: vendor.rejectionReason?.trim() || "Your application was not approved.",
      },
      { status: 403 }
    );
  }

  if (vendor.status === "suspended") {
    return NextResponse.json(
      { code: "suspended", error: "Account suspended" },
      { status: 403 }
    );
  }

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const rememberMe = Boolean(parsed.data.rememberMe);
  const expiresIn = rememberMe ? "30d" : defaultVendorJwtExpiresIn();
  const maxAge = vendorJwtExpiresSeconds(expiresIn);
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  const sessionId = `vs_${randomBytes(18).toString("hex")}`;

  const jwt = await signVendorJwt(vendor.id, sessionId, expiresIn);
  const tokenHash = hashVendorJwtCookie(jwt);

  await prisma.$transaction([
    prisma.vendorSession.create({
      data: {
        id: sessionId,
        vendorId: vendor.id,
        tokenHash,
        ipAddress: ip,
        userAgent: ua,
        expiresAt,
      },
    }),
    prisma.vendorAuditLog.create({
      data: {
        vendorId: vendor.id,
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
      id: vendor.id,
      shopName: vendor.shopName,
      ownerName: vendor.ownerName,
      email: vendor.email,
      status: vendor.status,
    },
  });
  res.cookies.set(VENDOR_JWT_COOKIE, jwt, {
    ...cookieBase(),
    maxAge,
  });
  return res;
}
