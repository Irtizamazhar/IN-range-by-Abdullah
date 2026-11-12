import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/marketplace-api";
import { customerRegistrationSameOrigin } from "@/lib/customer-registration-origin";
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const newPrivateToken = () => randomBytes(32).toString("hex");
export const privateCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 30 * 86400 };
export function featureWrite(request: Request) {
  if (!request.headers.get("origin")) throw new ApiError(403, "Please use the JORO website.");
  customerRegistrationSameOrigin(request);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 12000) throw new ApiError(413, "Request is too large.");
}
export function privateCookie(name: string) {
  const token = cookies().get(name)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
/** Atomic shared-database windows, including across Node workers. Never store raw IPs. */
export async function featureRate(scope: string, identity: string, points: number, seconds: number) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const key = tokenHash(`${scope}:${identity}:${bucket}`);
  const expiresAt = new Date((bucket + 2) * seconds * 1000);
  const row = await prisma.publicFeatureRate.upsert({ where: { key }, create: { key, expiresAt }, update: { count: { increment: 1 } } });
  if (row.count > points) throw new ApiError(429, "Please wait before trying again.");
}
export function requestAddress(request: Request) {
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
