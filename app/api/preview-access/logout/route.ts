export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { PREVIEW_SESSION_COOKIE, previewSessionCookieOptions } from "@/lib/private-launch/session";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(PREVIEW_SESSION_COOKIE, "", previewSessionCookieOptions(0));
  return res;
}
