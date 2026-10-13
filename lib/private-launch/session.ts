/**
 * Private launch (maintenance) gate — configuration and preview sessions.
 *
 * Edge-safe: imported by middleware, so it must not use Node APIs or Prisma.
 *
 * Environment:
 * - MAINTENANCE_MODE=true          turns the gate on (anything else = off).
 * - PREVIEW_ALLOWED_EMAILS=a@x,b@y explicit team allowlist (empty = nobody).
 * - PREVIEW_SESSION_SECRET=...     HS256 key, at least 32 characters.
 *
 * The gate fails closed: with the gate on and no valid secret or allowlist,
 * no preview session can be created or accepted.
 */
import { SignJWT, jwtVerify } from "jose";

const useSecureCookies = process.env.NODE_ENV === "production";

/** `__Host-` binds the cookie to this exact host over HTTPS with path=/. */
export const PREVIEW_SESSION_COOKIE = useSecureCookies ? "__Host-joro-preview" : "joro-preview";
export const PREVIEW_SESSION_MAX_AGE_SECONDS = 3 * 24 * 60 * 60;
const PREVIEW_TOKEN_TYPE = "joro-preview";
const MIN_SECRET_LENGTH = 32;

export function isMaintenanceMode(env: NodeJS.ProcessEnv = process.env) {
  return env.MAINTENANCE_MODE?.trim().toLowerCase() === "true";
}

export function previewAllowedEmails(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(
    (env.PREVIEW_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPreviewEmailAllowed(email: string, env: NodeJS.ProcessEnv = process.env) {
  return previewAllowedEmails(env).has(email.trim().toLowerCase());
}

function previewSecretKey(env: NodeJS.ProcessEnv = process.env): Uint8Array | null {
  const secret = env.PREVIEW_SESSION_SECRET?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return new TextEncoder().encode(secret);
}

export function isPreviewGateConfigured(env: NodeJS.ProcessEnv = process.env) {
  return previewSecretKey(env) !== null && previewAllowedEmails(env).size > 0;
}

export async function createPreviewSessionToken(email: string, env: NodeJS.ProcessEnv = process.env) {
  const key = previewSecretKey(env);
  if (!key) throw new Error("PREVIEW_SESSION_SECRET is missing or shorter than 32 characters");
  return new SignJWT({ typ: PREVIEW_TOKEN_TYPE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email.trim().toLowerCase())
    .setIssuedAt()
    .setExpirationTime(`${PREVIEW_SESSION_MAX_AGE_SECONDS}s`)
    .sign(key);
}

/**
 * Returns the team member's email when the token is valid, unexpired and the
 * email is still on the allowlist (removing an email revokes access at once).
 */
export async function verifyPreviewSessionToken(
  token: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  const key = previewSecretKey(env);
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (payload.typ !== PREVIEW_TOKEN_TYPE || typeof payload.sub !== "string") return null;
    return isPreviewEmailAllowed(payload.sub, env) ? payload.sub : null;
  } catch {
    return null;
  }
}

export function previewSessionCookieOptions(maxAge = PREVIEW_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
