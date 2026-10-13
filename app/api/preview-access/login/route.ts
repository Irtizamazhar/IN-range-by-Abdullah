export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { consumeOrReject, createLoginRateLimiter } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/vendor-ip";
import {
  PREVIEW_SESSION_COOKIE,
  createPreviewSessionToken,
  isMaintenanceMode,
  isPreviewGateConfigured,
  previewSessionCookieOptions,
} from "@/lib/private-launch/session";
import { verifyTeamCredentials } from "@/lib/private-launch/team-credentials";

/** 5 attempts / 15 minutes per IP. */
const ipLimiter = createLoginRateLimiter();
/** 10 attempts / hour per email, so rotating IPs cannot brute-force one account. */
const emailLimiter = new RateLimiterMemory({ points: 10, duration: 60 * 60 });

const INVALID = "Invalid email or password.";

function json(body: Record<string, unknown>, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function isSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

function tooMany(retrySecs: number) {
  return json(
    { error: `Too many attempts. Try again in ${Math.ceil(retrySecs / 60)} minute(s).` },
    429,
    { "Retry-After": String(retrySecs) },
  );
}

export async function POST(req: NextRequest) {
  if (!isMaintenanceMode()) return json({ error: "Not found" }, 404);
  if (!isSameOrigin(req)) return json({ error: "Forbidden" }, 403);

  const ipLimit = await consumeOrReject(ipLimiter, `preview-login:${clientIp(req)}`);
  if (!ipLimit.ok) return tooMany(ipLimit.retrySecs);

  let email = "";
  let password = "";
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
    password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  } catch {
    return json({ error: INVALID }, 400);
  }
  if (!email || !password) return json({ error: INVALID }, 400);

  const emailLimit = await consumeOrReject(emailLimiter, `preview-login:${email}`);
  if (!emailLimit.ok) return tooMany(emailLimit.retrySecs);

  if (!isPreviewGateConfigured()) {
    console.error(
      "[private-launch] Team login is disabled: set PREVIEW_SESSION_SECRET (32+ chars) and PREVIEW_ALLOWED_EMAILS.",
    );
    return json({ error: "Team login is not available right now." }, 503);
  }

  const verified = await verifyTeamCredentials(email, password);
  if (!verified) return json({ error: INVALID }, 401);

  await emailLimiter.delete(`preview-login:${email}`);
  const res = json({ ok: true }, 200);
  res.cookies.set(PREVIEW_SESSION_COOKIE, await createPreviewSessionToken(verified), previewSessionCookieOptions());
  return res;
}
