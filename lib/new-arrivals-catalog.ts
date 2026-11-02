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

/**
 * Active products whose `createdAt` is within the 14-day New Arrivals window
 * (`product-new-arrival-window`), newest first. Admin-added New Arrivals are ordinary
 * Product rows (`na-<legacyId>`), so they come from the same query and stay in All
 * Products after the window; they keep their legacy `/new-arrivals/<id>` card here.
 */
export async function loadMergedNewArrivalCards(options: {
  search: string;
  category: string;
}): Promise<NewArrivalMergedCard[]> {
  const { search, category } = options;
  const windowStart = newArrivalsWindowStart();

  const legacyById = new Map(
    sortedNewArrivalRows(await readProducts()).map((p) => [`na-${p.id}` as string, p] as const)
  );

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
  const cards: NewArrivalMergedCard[] = prismaRows.map((p) => {
    const legacy = legacyById.get(p.id);
    if (legacy) return { ...storedProductToNewArrivalCard(legacy), createdAtTs: +new Date(p.createdAt) };
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

  return cards.sort((a, b) => b.createdAtTs - a.createdAtTs);
}
