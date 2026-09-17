export const dynamic = "force-dynamic";

import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string } };

function storagePath(fileUrl: string): string | null {
  const normalized = fileUrl.replace(/\\/g, "/");
  const relative = normalized.startsWith("/uploads/vendor-docs/")
    ? normalized.slice("/uploads/".length)
    : normalized;
  if (!/^vendor-docs\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(relative)) return null;
  const base = path.resolve(process.cwd(), "storage", "private");
  const resolved = path.resolve(base, ...relative.split("/"));
  return resolved.startsWith(`${base}${path.sep}`) ? resolved : null;
}

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
  const filePath = storagePath(document.fileUrl);
  if (!filePath) return NextResponse.json({ error: "Invalid file record" }, { status: 500 });
  try {
    const data = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const mime =
      extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
    return new NextResponse(data, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
