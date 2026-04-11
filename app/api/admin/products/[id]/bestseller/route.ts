export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

/** Next may pass `params` as a plain object or a Promise (align with other app routes). */
type RouteParams = { id: string } | Promise<{ id: string }>;

type Ctx = { params: RouteParams };

async function resolveProductId(params: RouteParams): Promise<string | null> {
  const resolved = await Promise.resolve(params);
  const id = resolved?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Toggle `Product.isBestSeller` (admin only).
 * Uses raw SQL when the generated Prisma client predates the `isBestSeller` field.
 */
export async function PATCH(_req: NextRequest, context: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = await resolveProductId(context.params);
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const exists = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
      const existing = await prisma.product.findUnique({
        where: { id },
        select: { id: true, isBestSeller: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const nextFlag = !Boolean(existing.isBestSeller);
      const updated = await prisma.product.update({
        where: { id },
        data: { isBestSeller: nextFlag },
        select: { id: true, isBestSeller: true },
      });
      return NextResponse.json({
        ok: true,
        isBestSeller: updated.isBestSeller,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!msg.includes("isBestSeller")) {
        throw e;
      }
      const rows = await prisma.$queryRaw<Array<{ b: unknown }>>`
        SELECT isBestSeller AS b FROM Product WHERE id = ${id} LIMIT 1
      `;
      if (!rows.length) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const current = Boolean(Number(rows[0].b));
      const nextFlag = !current;
      await prisma.$executeRaw`
        UPDATE Product SET isBestSeller = ${nextFlag} WHERE id = ${id}
      `;
      return NextResponse.json({
        ok: true,
        isBestSeller: nextFlag,
      });
    }
  } catch (e) {
    console.error("PATCH /api/admin/products/[id]/bestseller", e);
    const message = e instanceof Error ? e.message : "Update failed";
    const missingColumn =
      message.includes("isBestSeller") ||
      message.includes("Unknown column") ||
      message.includes("does not exist");
    return NextResponse.json(
      {
        error: missingColumn
          ? "Database is missing the isBestSeller column. Run: npx prisma db push"
          : message,
      },
      { status: missingColumn ? 503 : 500 }
    );
  }
}
