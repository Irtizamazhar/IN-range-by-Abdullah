import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ReviewStat = { reviewCount: number; ratingAvg: number };

const approvedReviewSelect = {
  id: true,
  name: true,
  rating: true,
  comment: true,
  imageUrl: true,
  createdAt: true,
} satisfies Prisma.ReviewSelect;

export type ApprovedReviewRow = Prisma.ReviewGetPayload<{
  select: typeof approvedReviewSelect;
}>;

export async function reviewStatsForProductIds(
  ids: string[]
): Promise<Map<string, ReviewStat>> {
  const map = new Map<string, ReviewStat>();
  if (!ids.length) return map;
  try {
    const rows = await prisma.review.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, approved: true },
      _avg: { rating: true },
      _count: { id: true },
    });
    for (const r of rows) {
      map.set(r.productId, {
        reviewCount: r._count.id,
        ratingAvg:
          r._avg.rating != null
            ? Math.round(Number(r._avg.rating) * 10) / 10
            : 0,
      });
    }
  } catch {
    /* DB unavailable */
  }
  return map;
}

export function pickReviewStat(
  map: Map<string, ReviewStat>,
  id: string
): ReviewStat {
  return map.get(id) ?? { reviewCount: 0, ratingAvg: 0 };
}

export type StarBreakdown = { star: number; count: number; percent: number };

export async function getApprovedReviewsForProduct(
  productId: string
): Promise<ApprovedReviewRow[]> {
  return prisma.review.findMany({
    where: { productId, approved: true },
    orderBy: { createdAt: "desc" },
    select: approvedReviewSelect,
  });
}

export async function createPendingReview(data: {
  name: string;
  email: string;
  rating: number;
  comment: string;
  productId: string;
  imageUrl?: string | null;
}) {
  return prisma.review.create({
    data: {
      name: data.name,
      email: data.email,
      rating: data.rating,
      comment: data.comment,
      productId: data.productId,
      imageUrl: data.imageUrl ?? null,
      approved: false,
    },
  });
}

export async function orderProductReviewExists(
  orderId: string,
  productId: string
): Promise<boolean> {
  const n = await prisma.review.count({
    where: { orderId, productId } as Prisma.ReviewWhereInput,
  });
  return n > 0;
}

export async function createApprovedOrderReview(data: {
  productId: string;
  orderId: string;
  customerId: string;
  name: string;
  email: string;
  rating: number;
  comment: string;
  imageUrl?: string | null;
}) {
  const url = (data.imageUrl || "").trim().slice(0, 2048);
  return prisma.review.create({
    data: {
      productId: data.productId,
      orderId: data.orderId,
      customerId: data.customerId,
      name: data.name,
      email: data.email,
      rating: data.rating,
      comment: data.comment.trim().length > 0 ? data.comment.trim() : "—",
      imageUrl: url || null,
      approved: true,
    } as Prisma.ReviewUncheckedCreateInput,
  });
}

export async function getProductReviewDashboard(productId: string) {
  const approved = await prisma.review.findMany({
    where: { productId, approved: true },
    select: { rating: true },
  });
  const totalCount = approved.length;
  const breakdown: StarBreakdown[] = [5, 4, 3, 2, 1].map((star) => {
    const count = approved.filter((x) => x.rating === star).length;
    return {
      star,
      count,
      percent: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    };
  });
  const averageRating =
    totalCount > 0
      ? Math.round(
          (approved.reduce((s, x) => s + x.rating, 0) / totalCount) * 10
        ) / 10
      : 0;
  return { averageRating, totalCount, breakdown };
}
