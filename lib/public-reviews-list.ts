import { prisma } from "@/lib/prisma";
import { readProducts } from "@/lib/products-store";

export type PublicReviewListItem = {
  id: number;
  scope: "product" | "newArrival";
  name: string;
  rating: number;
  comment: string;
  imageUrl: string | null;
  createdAt: Date;
  itemName: string;
  itemHref: string;
};

/**
 * Approved catalog + new-arrival reviews, newest first (for /reviews and home).
 */
export async function getApprovedPublicReviews(options?: {
  take?: number;
}): Promise<PublicReviewListItem[]> {
  const [catalog, naRows, stored] = await Promise.all([
    prisma.review.findMany({
      where: { approved: true },
      orderBy: { createdAt: "desc" },
      include: { product: { select: { id: true, name: true } } },
    }),
    prisma.newArrivalReview.findMany({
      where: { approved: true },
      orderBy: { createdAt: "desc" },
    }),
    readProducts(),
  ]);

  const nameByNaId = new Map(stored.map((p) => [p.id, p.name]));

  const merged: PublicReviewListItem[] = [
    ...catalog.map((r) => ({
      id: r.id,
      scope: "product" as const,
      name: r.name,
      rating: r.rating,
      comment: r.comment,
      imageUrl: r.imageUrl,
      createdAt: r.createdAt,
      itemName: r.product.name,
      itemHref: `/products/${r.product.id}`,
    })),
    ...naRows.map((r) => ({
      id: r.id,
      scope: "newArrival" as const,
      name: r.name,
      rating: r.rating,
      comment: r.comment,
      imageUrl: r.imageUrl,
      createdAt: r.createdAt,
      itemName:
        nameByNaId.get(r.newArrivalId) ?? `New arrival #${r.newArrivalId}`,
      itemHref: `/new-arrivals/${r.newArrivalId}`,
    })),
  ];

  merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  if (options?.take != null) {
    return merged.slice(0, options.take);
  }
  return merged;
}
