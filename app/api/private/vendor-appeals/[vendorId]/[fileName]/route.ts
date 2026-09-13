export const dynamic = "force-dynamic";

import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { getAppealVendorId } from "@/lib/vendor-appeal-auth";

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

  const base = path.resolve(process.cwd(), "storage", "private", "vendor-appeals");
  const filePath = path.resolve(base, vendorId, fileName);
  if (!filePath.startsWith(`${base}${path.sep}`)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const data = await fs.readFile(filePath);
    const extension = path.extname(fileName).toLowerCase();
    const mime = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
    return new NextResponse(data, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
