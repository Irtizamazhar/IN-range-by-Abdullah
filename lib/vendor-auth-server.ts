import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { VENDOR_JWT_COOKIE } from "@/lib/vendor-cookies";
import { hashVendorJwtCookie } from "@/lib/vendor-token-hash";
import { verifyVendorJwtToken } from "@/lib/vendor-jwt";
import { resolveVendorJwtSecretKey } from "@/lib/vendor-jwt-secret";
import type { VendorMe } from "@/lib/vendor-me-type";

export type VendorMePayload = VendorMe;

export async function getVendorFromSession(): Promise<{
  vendor: VendorMePayload;
} | null> {
  if (!resolveVendorJwtSecretKey()) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(VENDOR_JWT_COOKIE)?.value;
  if (!token) return null;

  let sub: string;
  let sid: string;
  try {
    const payload = await verifyVendorJwtToken(token);
    sub = payload.sub;
    sid = payload.sid;
  } catch {
    return null;
  }

  const tokenHash = hashVendorJwtCookie(token);
  const session = await prisma.vendorSession.findFirst({
    where: {
      id: sid,
      vendorId: sub,
      tokenHash,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    include: {
      vendor: {
        select: {
          id: true,
          shopName: true,
          ownerName: true,
          email: true,
          phone: true,
          city: true,
          status: true,
          isEmailVerified: true,
          primaryCategory: true,
          businessType: true,
        } satisfies Record<keyof VendorMe, true>,
      },
    },
  });

  if (!session?.vendor) return null;
  return { vendor: session.vendor };
}

export async function requireVendorFromSession(): Promise<VendorMePayload> {
  const row = await getVendorFromSession();
  if (!row) {
    throw new Error("UNAUTHORIZED");
  }
  return row.vendor;
}
