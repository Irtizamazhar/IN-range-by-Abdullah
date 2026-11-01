export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";

import { CLOUDINARY_REFERENCE_MIME, cloudinaryImageReference } from "@/lib/cloudinary-policy";

import { PUBLIC_UPLOAD_REFERENCE_MIME, publicUploadUrl } from "@/lib/public-uploads";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, context: Ctx) {
  const { id } = context.params;
  const row = await prisma.productImage.findUnique({
    where: { id },
    include: { product: { select: { id: true, isActive: true } } },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!row.productId) {
    const auth = await requireAdminPermission("catalog.manage");
    if ("response" in auth) return auth.response;
  } else if (!row.product?.isActive) {
    const session = await getAdminSession();
    if (session?.user?.role !== "admin") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const auth = await requireAdminPermission("catalog.manage");
    if ("response" in auth) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.mimeType === PUBLIC_UPLOAD_REFERENCE_MIME) {
    const url = Buffer.from(row.data).toString("utf8");
    if (!publicUploadUrl(url)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(null, { status: 307, headers: { Location: url } });
  }
  if (row.mimeType === CLOUDINARY_REFERENCE_MIME) {
    const url = Buffer.from(row.data).toString("utf8");
    if (!cloudinaryImageReference(url)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.redirect(url, 307);
  }
  return new NextResponse(new Uint8Array(row.data), {
    status: 200,
    headers: {
      "Content-Type": row.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
