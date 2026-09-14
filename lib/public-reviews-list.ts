import { prisma } from "@/lib/prisma";
import { productReviewStatsService } from "@/lib/product-review-stats-service";

export type PublicReviewListItem = {
  id: number;
  scope: "product";
  name: string;
  rating: number;
  comment: string;
  imageUrl: string | null;
  createdAt: Date;
  itemName: string;
  itemHref: string;
  verifiedPurchase: true;
};

/**
 * Guest/new-arrival rows remain preserved for admin/history, but only verified
 * customer purchases can appear in the public review feed.
 */
export async function getApprovedPublicReviews(options?: {
  take?: number;
}): Promise<PublicReviewListItem[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const nameById = new Map(products.map((product) => [product.id, product.name]));
  const rows = await productReviewStatsService(products.map((product) => product.id));
  const reviews = rows
    .map((review) => ({
      id: review.id,
      scope: "product" as const,
      name: review.name,
      rating: review.rating,
      comment: review.comment,
      imageUrl: review.imageUrl,
      createdAt: review.createdAt,
      itemName: nameById.get(review.productId) || "Product",
      itemHref: `/products/${review.productId}`,
      verifiedPurchase: review.verifiedPurchase,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return options?.take == null ? reviews : reviews.slice(0, options.take);
}
