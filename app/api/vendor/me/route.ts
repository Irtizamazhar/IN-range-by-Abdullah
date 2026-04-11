export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getVendorFromSession } from "@/lib/vendor-auth-server";

export async function GET() {
  const row = await getVendorFromSession();
  if (!row) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ vendor: row.vendor });
}
