export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";

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

  return new NextResponse(new Uint8Array(row.data), {
    status: 200,
    headers: {
      "Content-Type": row.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
