export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { VENDOR_JWT_COOKIE } from "@/lib/vendor-cookies";
import { getVendorFromSession } from "@/lib/vendor-auth-server";

export async function GET() {
  const row = await getVendorFromSession();
  if (!row) {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  return NextResponse.json({ vendor: row.vendor });
}
