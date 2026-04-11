import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

/** Vendor/customer login: 5 attempts / 15 minutes per key (e.g. IP). */
export function createLoginRateLimiter() {
  return new RateLimiterMemory({
    points: 5,
    duration: 15 * 60,
  });
}

/** Registration: 3 / hour per IP. */
export function createRegisterRateLimiter() {
  return new RateLimiterMemory({
    points: 3,
    duration: 60 * 60,
  });
}

/** General API: 100 / minute per key. */
export function createApiRateLimiter() {
  return new RateLimiterMemory({
    points: 100,
    duration: 60,
  });
}

/** File uploads per vendor key: 10 / hour. */
export function createUploadRateLimiter() {
  return new RateLimiterMemory({
    points: 10,
    duration: 60 * 60,
  });
}

export type RateLimitResult = { ok: true } | { ok: false; retrySecs: number };

export async function consumeOrReject(
  limiter: RateLimiterMemory,
  key: string
): Promise<RateLimitResult> {
  try {
    await limiter.consume(key, 1);
    return { ok: true };
  } catch (e) {
    const res = e as RateLimiterRes;
    const retrySecs = Math.ceil(res.msBeforeNext / 1000) || 60;
    return { ok: false, retrySecs };
  }
}
