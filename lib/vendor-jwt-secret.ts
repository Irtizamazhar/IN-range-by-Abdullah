/**
 * HS256 secret for vendor sessions. **Production** must set `VENDOR_JWT_SECRET`.
 * **Development** uses a fixed fallback so `/vendor/login` works without editing `.env`
 * (tokens are not portable to prod; set a real secret before go-live).
 */
const DEV_FALLBACK =
  "inrange-dev-only-vendor-jwt-secret-min-48-characters!!";

let devWarnLogged = false;

export function resolveVendorJwtSecretKey(): Uint8Array | null {
  const trimmed = process.env.VENDOR_JWT_SECRET?.trim();
  if (trimmed) {
    return new TextEncoder().encode(trimmed);
  }
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  if (!devWarnLogged) {
    devWarnLogged = true;
    console.warn(
      "[vendor-auth] VENDOR_JWT_SECRET is not set — using a dev-only default. " +
        "Add VENDOR_JWT_SECRET to .env.local for stable tokens across restarts, " +
        "and it is required in production."
    );
  }
  return new TextEncoder().encode(DEV_FALLBACK);
}
