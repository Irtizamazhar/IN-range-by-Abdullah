export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { VENDOR_JWT_COOKIE } from "@/lib/vendor-cookies";
import { hashVendorJwtCookie } from "@/lib/vendor-token-hash";
import { verifyVendorJwtToken } from "@/lib/vendor-jwt";
import { resolveVendorJwtSecretKey } from "@/lib/vendor-jwt-secret";

function clearCookie(res: NextResponse) {
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(VENDOR_JWT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: 0,
  });
  return res;
}

export async function POST() {
  const res = NextResponse.json({ ok: true, message: "Signed out" });
  const cookieStore = await cookies();
  const token = cookieStore.get(VENDOR_JWT_COOKIE)?.value;
  clearCookie(res);

  if (token && resolveVendorJwtSecretKey()) {
    try {
      const { sub, sid } = await verifyVendorJwtToken(token);
      const tokenHash = hashVendorJwtCookie(token);
      await prisma.vendorSession.updateMany({
        where: {
          id: sid,
          vendorId: sub,
          tokenHash,
          isRevoked: false,
        },
        data: { isRevoked: true },
      });
    } catch {
      /* invalid token — cookie cleared */
    }
  }

  return res;
}
