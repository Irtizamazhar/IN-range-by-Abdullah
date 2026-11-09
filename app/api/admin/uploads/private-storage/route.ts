import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { privateStorageDiagnostics } from "@/lib/private-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only check, run inside the real application process, that PRIVATE_STORAGE_DIR is configured,
 * separate from public uploads, and readable/writable. Never returns filesystem paths.
 * `persistenceVerified` stays false: only a redeploy test proves files survive a release switch.
 */
export async function GET() {
  const auth = await requireAdminPermission("vendors.manage");
  if ("response" in auth) return auth.response;
  const result = await privateStorageDiagnostics();
  return NextResponse.json({ ...result, persistenceVerified: false }, { status: result.usable ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
