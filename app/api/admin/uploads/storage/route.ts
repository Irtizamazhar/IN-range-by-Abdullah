import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { inspectPublicStorage } from "@/lib/public-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminPermission("catalog.manage");
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json(await inspectPublicStorage(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ configured: Boolean(process.env.UPLOADS_DIR?.trim()), accessibleToNodeProcess: false,
      error: "Public image storage is unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
