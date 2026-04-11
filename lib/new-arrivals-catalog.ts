import type { ProductCardData } from "@/components/user/ProductCard";
import { prisma } from "@/lib/prisma";
import {
  sortedNewArrivalRows,
  storedProductToNewArrivalCard,
} from "@/lib/new-arrival-product-card";
import { readProducts } from "@/lib/products-store";
import { serializeProduct } from "@/lib/serialize";
import { pickReviewStat, reviewStatsForProductIds } from "@/lib/review-stats";
import { newArrivalsWindowStart } from "@/lib/product-new-arrival-window";
import type { Prisma } from "@prisma/client";
import { catalogProductSelect } from "@/lib/catalog-product-select";

export type NewArrivalMergedCard = ProductCardData & {
  createdAtTs: number;
};

function matchesJsonRow(
  p: { name: string; category: string },
  search: string,
  category: string
) {
  const text = `${String(p.name || "")} ${String(p.category || "")}`.toLowerCase();
  const matchesSearch =
    !search || text.includes(String(search).toLowerCase());
  const matchesCategory =
    !category || String(p.category || "") === category;
  return matchesSearch && matchesCategory;
}

/**
 * JSON-file new arrivals plus active Prisma products whose `createdAt` is within the
 * homepage new-arrivals window (14 days from `product-new-arrival-window`), merged newest-first.
 */
export async function loadMergedNewArrivalCards(options: {
  search: string;
  category: string;
}): Promise<NewArrivalMergedCard[]> {
  const { search, category } = options;
  const windowStart = newArrivalsWindowStart();

  const jsonRows = sortedNewArrivalRows(await readProducts()).filter((p) =>
    matchesJsonRow(
      { name: String(p.name || ""), category: String(p.category || "") },
      search,
      category
    )
  );
  const jsonPart: NewArrivalMergedCard[] = jsonRows.map((p) => ({
    ...storedProductToNewArrivalCard(p),
    createdAtTs: +new Date(p.createdAt || "1970-01-01"),
  }));

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    createdAt: { gte: windowStart },
  };
  if (category) {
    where.category = category;
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const prismaRows = await prisma.product.findMany({
    where,
    select: catalogProductSelect(),
  });
  const stats = await reviewStatsForProductIds(prismaRows.map((p) => p.id));
  const prismaPart: NewArrivalMergedCard[] = prismaRows.map((p) => {
    const base = serializeProduct(p, { forAdmin: false });
    const stat = pickReviewStat(stats, String(base._id));
    return {
      _id: String(base._id),
      name: base.name,
      price: base.price,
      originalPrice: base.originalPrice,
      discountPercent: base.discountPercent,
      images: base.images,
      category: base.category,
      stock: base.stock,
      href: `/products/${base._id}`,
      reviewCount: stat.reviewCount,
      ratingAvg: stat.ratingAvg,
      createdAtTs: +new Date(p.createdAt),
    };
  });

  return [...prismaPart, ...jsonPart].sort(
    (a, b) => b.createdAtTs - a.createdAtTs
  );
}
