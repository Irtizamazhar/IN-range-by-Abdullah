export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { ORDER_INCLUDE_REVIEW } from "@/lib/prisma-order-includes";
import { isPurchaseBackedReview } from "@/lib/product-review-stats-service";
import { isPublicReviewPhotoUrl } from "@/lib/review-policy";
import { readProducts } from "@/lib/products-store";

export async function GET() {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;

  try {
    const [reviews, newArrivalReviews, storedProducts] = await Promise.all([
      prisma.review.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true } },
          order: { include: ORDER_INCLUDE_REVIEW },
        },
      }),
      prisma.newArrivalReview.findMany({
        orderBy: { createdAt: "desc" },
      }),
      readProducts(),
    ]);

    const nameByNewArrivalId = new Map(storedProducts.map((p) => [p.id, p.name]));

    const catalogRows = reviews.map((r) => ({
      id: r.id,
      scope: "product" as const,
      name: r.name,
      email: r.email,
      rating: r.rating,
      comment: r.comment,
      imageUrl:
        r.imageUrl && isPublicReviewPhotoUrl(r.imageUrl) ? r.imageUrl : null,
      createdAt: r.createdAt.toISOString(),
      approved: r.approved,
      withdrawn: r.withdrawn,
      verifiedPurchase: isPurchaseBackedReview(r),
      productId: r.product.id,
      productName: r.product.name,
    }));

    const naRows = newArrivalReviews.map((r) => ({
      id: r.id,
      scope: "newArrival" as const,
      name: r.name,
      email: r.email,
      rating: r.rating,
      comment: r.comment,
      imageUrl:
        r.imageUrl && isPublicReviewPhotoUrl(r.imageUrl) ? r.imageUrl : null,
      createdAt: r.createdAt.toISOString(),
      approved: r.approved,
      withdrawn: false,
      verifiedPurchase: false,
      productId: `na-${r.newArrivalId}`,
      productName:
        nameByNewArrivalId.get(r.newArrivalId) ?? `New arrival #${r.newArrivalId}`,
    }));

    const merged = [...catalogRows, ...naRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ reviews: merged });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load reviews" },
      { status: 500 }
    );
  }
}
