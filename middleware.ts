import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth-cookies";
import { VENDOR_JWT_COOKIE } from "@/lib/vendor-cookies";
import { resolveVendorJwtSecretKey } from "@/lib/vendor-jwt-secret";

function vendorJwtSecretKey() {
  return resolveVendorJwtSecretKey();
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/vendor/dashboard")) {
    const secret = vendorJwtSecretKey();
    const token = req.cookies.get(VENDOR_JWT_COOKIE)?.value;

    if (!secret || !token) {
      return NextResponse.redirect(new URL("/vendor/login", req.url));
    }
    // Edge middleware can be sensitive to env/crypto differences during local dev.
    // We only gate on cookie presence here; full token + DB-session verification is
    // performed server-side in vendor dashboard/layout via getVendorFromSession().
    return NextResponse.next();
  }

  if (path.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  if (path.startsWith("/admin")) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET!,
      cookieName: ADMIN_SESSION_COOKIE,
    });
    return !token || (token as { role?: string }).role !== "admin"
      ? NextResponse.redirect(new URL("/admin/login", req.url))
      : NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/vendor/dashboard/:path*"],
};
