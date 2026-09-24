import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const OAUTH_PLACEHOLDER_HASH =
  "$2b$10$UoH4j7Gyt7qR95R5M6b8suXNG7QDGtFKwM9lYjLw9M4iyf2EG6m9e";
export const CUSTOMER_PASSWORD_REAUTH_COOKIE = "joro-customer-password-reauth";
export const CUSTOMER_PASSWORD_REAUTH_MAX_AGE_SECONDS = 10 * 60;

type ReauthIntent = { customerId: string; issuedAt: number; nonce: string };

function secret() {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("NEXTAUTH_SECRET is required");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createPasswordReauthIntent(customerId: string) {
  const intent: ReauthIntent = { customerId, issuedAt: Date.now(), nonce: randomUUID() };
  const payload = Buffer.from(JSON.stringify(intent)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyPasswordReauthIntent(value: string | undefined, now = Date.now()) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const intent = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<ReauthIntent>;
    if (typeof intent.customerId !== "string" || typeof intent.issuedAt !== "number" || typeof intent.nonce !== "string") return null;
    const age = now - intent.issuedAt;
    if (age < 0 || age > CUSTOMER_PASSWORD_REAUTH_MAX_AGE_SECONDS * 1000) return null;
    return intent as ReauthIntent;
  } catch {
    return null;
  }
}

export function isOAuthOnlyPasswordHash(passwordHash: string) {
  return passwordHash === OAUTH_PLACEHOLDER_HASH || passwordHash.startsWith("oauth-only:");
}

export function hasLocalPassword(passwordHash: string) {
  return !isOAuthOnlyPasswordHash(passwordHash);
}