export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PREVIEW_SESSION_COOKIE, isMaintenanceMode, verifyPreviewSessionToken } from "@/lib/private-launch/session";

export async function GET(req: NextRequest) {
  const active = isMaintenanceMode() && Boolean(await verifyPreviewSessionToken(req.cookies.get(PREVIEW_SESSION_COOKIE)?.value));
  return NextResponse.json({ active }, { headers: { "Cache-Control": "private, no-store" } });
}
