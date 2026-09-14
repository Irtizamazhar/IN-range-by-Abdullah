import { prisma } from "@/lib/prisma";
import { productReviewStatsService } from "@/lib/product-review-stats-service";

export type VendorReviewStat = { reviewCount: number; ratingAvg: number };

/**
 * Public store ratings use the same canonical, purchase-backed product review
 * rows as product pages. Legacy VendorReview rows are retained but excluded:
 * that model has no active customer submission flow or canonical uniqueness.
 */
export async function vendorReviewStatsService(vendorIds: string[]) {
  const ids = Array.from(new Set(vendorIds.filter(Boolean)));
  const result = new Map<string, VendorReviewStat>();
  for (const id of ids) result.set(id, { reviewCount: 0, ratingAvg: 0 });
  if (!ids.length) return result;

  const publications = await prisma.vendorProduct.findMany({
    where: {
      vendorId: { in: ids },
      publishedProductId: { not: null },
    },
    select: { vendorId: true, publishedProductId: true },
  });
  const vendorByProductId = new Map<string, string>();
  for (const publication of publications) {
    if (publication.publishedProductId) {
      vendorByProductId.set(
        publication.publishedProductId,
        publication.vendorId
      );
    }
  }

  const reviews = await productReviewStatsService(
    Array.from(vendorByProductId.keys())
  );
  const totals = new Map<string, { count: number; sum: number }>();
  for (const review of reviews) {
    const vendorId = vendorByProductId.get(review.productId);
    if (!vendorId) continue;
    const total = totals.get(vendorId) ?? { count: 0, sum: 0 };
    total.count += 1;
    total.sum += review.rating;
    totals.set(vendorId, total);
  }

  for (const id of ids) {
    const total = totals.get(id);
    result.set(id, {
      reviewCount: total?.count ?? 0,
      ratingAvg: total?.count
        ? Math.round((total.sum / total.count) * 10) / 10
        : 0,
    });
  }
  return result;
}
