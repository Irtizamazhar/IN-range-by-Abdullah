import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const RESET_TTL_MS = 5 * 60 * 1000;
export const OTP_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const recoveryEmail = z.string().trim().toLowerCase().email().max(255);
// Match customer registration, including bcrypt's UTF-8 byte limit.
export const recoveryPassword = z.string().min(6).max(72)
  .refine(value => Buffer.byteLength(value, "utf8") <= 72, "Use at most 72 UTF-8 bytes.");
export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newResetToken = () => randomBytes(32).toString("hex");
export const newOtp = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

export function otpVerifier(challengeId: string, code: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Password recovery requires NEXTAUTH_SECRET.");
  return createHmac("sha256", secret).update(`customer-password-reset:${challengeId}:${code}`).digest("hex");
}

export function matchesOtp(challengeId: string, code: string, verifier: string) {
  const actual = Buffer.from(otpVerifier(challengeId, code), "hex");
  const expected = Buffer.from(verifier, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function usableOtp(row: { otpHash: string | null; attempts: number; usedAt: Date | null; expiresAt: Date }, now = Date.now()) {
  return Boolean(row.otpHash && !row.usedAt && row.attempts < OTP_MAX_ATTEMPTS && row.expiresAt.getTime() > now);
}
