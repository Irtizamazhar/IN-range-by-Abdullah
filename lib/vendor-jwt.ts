import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { resolveVendorJwtSecretKey } from "@/lib/vendor-jwt-secret";

function secretKey(): Uint8Array {
  const k = resolveVendorJwtSecretKey();
  if (!k) {
    throw new Error("VENDOR_JWT_SECRET is required in production");
  }
  return k;
}

export type VendorJwtPayload = JWTPayload & {
  sub: string;
  sid: string;
};

export async function signVendorJwt(
  vendorId: string,
  sessionId: string,
  expiresIn: string
): Promise<string> {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(vendorId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifyVendorJwtToken(
  token: string
): Promise<VendorJwtPayload> {
  const { payload } = await jwtVerify(token, secretKey());
  if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
    throw new Error("Invalid vendor token payload");
  }
  return payload as VendorJwtPayload;
}
