import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { resolveVendorJwtSecretKey } from "@/lib/vendor-jwt-secret";

export const VENDOR_APPEAL_COOKIE = "vendor_appeal_token";

export async function signVendorAppealToken(vendorId: string): Promise<string> {
  const key = resolveVendorJwtSecretKey();
  if (!key) throw new Error("Vendor authentication is not configured");
  return new SignJWT({ purpose: "vendor-appeal" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(vendorId)
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(key);
}

export async function getAppealVendorId(): Promise<string | null> {
  const token = cookies().get(VENDOR_APPEAL_COOKIE)?.value;
  const key = resolveVendorJwtSecretKey();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload.purpose === "vendor-appeal" && typeof payload.sub === "string"
      ? payload.sub : null;
  } catch {
    return null;
  }
}
