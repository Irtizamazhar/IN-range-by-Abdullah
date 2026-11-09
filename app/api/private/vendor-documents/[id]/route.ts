export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { prisma } from "@/lib/prisma";
import { normalizePrivatePath, privateImageMime, readPrivateFile } from "@/lib/private-storage";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, context: Ctx) {
  const document = await prisma.vendorDocument.findUnique({
    where: { id: context.params.id },
  });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = await getAdminSession();
  if (admin?.user?.role === "admin") {
    const auth = await requireAdminPermission("vendors.manage");
    if ("response" in auth) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else {
    const vendor = await getVendorFromSession({allowUnapproved:true});
    if (!vendor || vendor.vendor.id !== document.vendorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
  const relative = normalizePrivatePath(document.fileUrl);
  if (!relative) return NextResponse.json({ error: "Invalid file record" }, { status: 500 });
  const data = await readPrivateFile(relative);
  if (!data) return NextResponse.json({ error: "File not found", code: "file_missing" }, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": privateImageMime(relative), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
