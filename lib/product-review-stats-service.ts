import type { Review } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  customerOwnsReviewOrder,
  isOrderProductDeliveredForReview,
  type OrderForReviewCheck,
} from "@/lib/order-review-eligibility";
import { ORDER_INCLUDE_REVIEW } from "@/lib/prisma-order-includes";
import {
  isPublicReviewPhotoUrl,
  sanitizeReviewComment,
} from "@/lib/review-policy";

export type ReviewWithPurchaseEvidence = Review & {
  order: OrderForReviewCheck | null;
};

/** A badge/aggregate is valid only while the referenced purchase still proves it. */
export function isPurchaseBackedReview(
  review: ReviewWithPurchaseEvidence
): boolean {
  return Boolean(
    review.customerId &&
      review.order &&
      customerOwnsReviewOrder(review.order.customerId, review.customerId) &&
      isOrderProductDeliveredForReview(review.order, review.productId)
  );
}

/**
 * Only approved, active, purchase-backed reviews contribute to trust. Legacy
 * duplicates are retained in the database but only the newest valid row per
 * customer/product is exposed.
 */
export async function productReviewStatsService(productIds: string[]) {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (!ids.length) return [];

  const rows = await prisma.review.findMany({
    where: {
      productId: { in: ids },
      approved: true,
      withdrawn: false,
      rating: { gte: 1, lte: 5 },
      customerId: { not: null },
      orderId: { not: null },
    },
    include: { order: { include: ORDER_INCLUDE_REVIEW } },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });

  const seen = new Set<string>();
  return rows
    .filter((row) => {
      const review = row as ReviewWithPurchaseEvidence;
      if (!isPurchaseBackedReview(review)) return false;
      const key = `${review.customerId}:${review.productId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((row) => ({
      id: row.id,
      productId: row.productId,
      name: sanitizeReviewComment(row.name).slice(0, 160) || "Customer",
      rating: row.rating,
      comment: sanitizeReviewComment(row.comment),
      imageUrl:
        row.imageUrl && isPublicReviewPhotoUrl(row.imageUrl)
          ? row.imageUrl
          : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      verifiedPurchase: true as const,
    }));
}
