/** Parses values like `7d`, `12h`, `30m` (default 7d if unknown). */
export function vendorJwtExpiresSeconds(exp: string): number {
  const s = exp.trim();
  const match = /^(\d+)\s*([smhd])$/i.exec(s);
  if (!match) return 7 * 24 * 60 * 60;
  const n = parseInt(match[1], 10);
  const u = match[2].toLowerCase();
  switch (u) {
    case "s":
      return n;
    case "m":
      return n * 60;
    case "h":
      return n * 60 * 60;
    case "d":
      return n * 24 * 60 * 60;
    default:
      return 7 * 24 * 60 * 60;
  }
}

export function defaultVendorJwtExpiresIn(): string {
  return process.env.VENDOR_JWT_EXPIRES_IN?.trim() || "7d";
}
