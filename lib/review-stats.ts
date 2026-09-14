import { productReviewStatsService } from "@/lib/product-review-stats-service";
export type ReviewStat = { reviewCount: number; ratingAvg: number };
export type ApprovedReviewRow = Awaited<ReturnType<typeof productReviewStatsService>>[number];
export type StarBreakdown = { star: number; count: number; percent: number };
export async function reviewStatsForProductIds(ids: string[]): Promise<Map<string, ReviewStat>> {
  const map = new Map<string, ReviewStat>(); if (!ids.length) return map;
  const rows = await productReviewStatsService(ids);
  const totals = new Map<string, { count: number; sum: number }>();
  for (const row of rows) {
    const total = totals.get(row.productId) ?? { count: 0, sum: 0 };
    total.count += 1;
    total.sum += row.rating;
    totals.set(row.productId, total);
  }
  for (const id of ids) {
    const total = totals.get(id);
    map.set(id, {
      reviewCount: total?.count ?? 0,
      ratingAvg: total?.count
        ? Math.round((total.sum / total.count) * 10) / 10
        : 0,
    });
  }
  return map;
}
export function pickReviewStat(map: Map<string, ReviewStat>, id: string): ReviewStat { return map.get(id) ?? { reviewCount: 0, ratingAvg: 0 }; }
export async function getApprovedReviewsForProduct(productId: string) { return productReviewStatsService([productId]); }
export async function getProductReviewDashboard(productId: string) {
  const rows = await getApprovedReviewsForProduct(productId); const totalCount = rows.length;
  return { totalCount, averageRating: totalCount ? Math.round(rows.reduce((s, r) => s + r.rating, 0) / totalCount * 10) / 10 : 0,
    breakdown: [5,4,3,2,1].map(star => { const count = rows.filter(r => r.rating === star).length; return { star, count, percent: totalCount ? Math.round(count / totalCount * 100) : 0 }; }) };
}
