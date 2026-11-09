export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { getAppealVendorId } from "@/lib/vendor-appeal-auth";
import { normalizePrivatePath, privateImageMime, readPrivateFile } from "@/lib/private-storage";

type Ctx = { params: { vendorId: string; fileName: string } };

export async function GET(_request: Request, context: Ctx) {
  const { vendorId, fileName } = context.params;
  if (!/^[A-Za-z0-9_-]+$/.test(vendorId) || !/^appeal-[A-Za-z0-9_.-]+$/.test(fileName)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const admin = await getAdminSession();
  if (admin?.user?.role === "admin") {
    const auth = await requireAdminPermission("vendors.manage");
    if ("response" in auth) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else {
    const authenticatedVendorId = await getAppealVendorId();
    if (authenticatedVendorId !== vendorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const relative = normalizePrivatePath(`vendor-appeals/${vendorId}/${fileName}`);
  if (!relative) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await readPrivateFile(relative);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": privateImageMime(relative), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
