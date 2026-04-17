export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/serialize";
import { pickReviewStat, reviewStatsForProductIds } from "@/lib/review-stats";

async function countBestSellerRows(): Promise<number> {
  try {
    return await prisma.product.count({
      where: { isBestSeller: true, isActive: true },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (!msg.includes("isBestSeller")) {
      throw e;
    }
    const rows = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) AS c FROM Product WHERE isActive = 1 AND isBestSeller = 1
    `;
    return Number(rows[0]?.c ?? 0);
  }
}

async function loadBestSellerRows(offset: number, limit: number) {
  try {
    return await prisma.product.findMany({
      where: {
        isBestSeller: true,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
      skip: offset,
      take: limit,
      select: catalogProductSelect({ take: 1 }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (!msg.includes("isBestSeller")) {
      throw e;
    }
    const lim = Number(limit);
    const off = Number(offset);
    const idRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM Product WHERE isActive = 1 AND isBestSeller = 1 ORDER BY updatedAt DESC LIMIT ${lim} OFFSET ${off}`
    );
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

/** Query: `limit` (default 6, max 48), `offset` (default 0). Returns ProductCard-shaped items + total count. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      48,
      Math.max(1, parseInt(searchParams.get("limit") || "6", 10))
    );
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    const [total, rows] = await Promise.all([
      countBestSellerRows(),
      loadBestSellerRows(offset, limit),
    ]);
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
    return NextResponse.json({ products, total, offset, limit });
  } catch (error) {
    console.error("GET /api/products/bestsellers", error);
    return NextResponse.json({ products: [], total: 0 });
  }
}
