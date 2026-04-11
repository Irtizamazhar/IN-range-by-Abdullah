export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/serialize";
import { pickReviewStat, reviewStatsForProductIds } from "@/lib/review-stats";

async function loadBestSellerRows() {
  try {
    return await prisma.product.findMany({
      where: {
        isBestSeller: true,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
      select: catalogProductSelect({ take: 1 }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (!msg.includes("isBestSeller")) {
      throw e;
    }
    const idRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM Product WHERE isActive = 1 AND isBestSeller = 1 ORDER BY updatedAt DESC LIMIT 24
    `;
    const ids = idRows.map((r) => r.id);
    if (ids.length === 0) {
      return [];
    }
    const unsorted = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: catalogProductSelect({ take: 1 }),
    });
    const rank = new Map(ids.map((id, i) => [id, i] as const));
    return [...unsorted].sort(
      (a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)
    );
  }
}

/** Public catalog: active products marked best seller (homepage + clients). */
export async function GET() {
  try {
    const rows = await loadBestSellerRows();
    const statsMap = await reviewStatsForProductIds(rows.map((p) => p.id));
    const products = rows.map((p) => {
      const base = serializeProduct(p, { forAdmin: false });
      const stat = pickReviewStat(statsMap, String(base._id));
      return {
        ...base,
        reviewCount: stat.reviewCount,
        ratingAvg: stat.ratingAvg,
      };
    });
    return NextResponse.json({ products });
  } catch (error) {
    console.error("GET /api/products/bestsellers", error);
    return NextResponse.json({ products: [] });
  }
}
