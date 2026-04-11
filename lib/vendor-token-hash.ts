import { createHash } from "crypto";

export function hashVendorJwtCookie(jwt: string): string {
  return createHash("sha256").update(jwt, "utf8").digest("hex");
}
