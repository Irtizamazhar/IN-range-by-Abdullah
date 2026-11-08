import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { indexableProductWhere } from "@/lib/seo-data";
import { productPath } from "@/lib/catalog-urls";
export const dynamic = "force-dynamic";
/** Public navigation only; no order, customer or cart state is accepted or returned. */
export async function GET(request: NextRequest) {
  const ids = Array.from(new Set(request.nextUrl.searchParams.getAll("id")));
  if (ids.length > 100 || ids.some(id => !/^[a-zA-Z0-9_-]{1,191}$/.test(id))) {
    return NextResponse.json({ error: "Invalid product references" }, { status: 400 });
  }
  const rows = ids.length ? await prisma.product.findMany({
    where: { AND: [indexableProductWhere, { id: { in: ids } }] }, select: { id: true, slug: true },
  }) : [];
  return NextResponse.json(Object.fromEntries(rows.map(row => [row.id, productPath(row)])), { headers: { "Cache-Control": "no-store" } });
}
