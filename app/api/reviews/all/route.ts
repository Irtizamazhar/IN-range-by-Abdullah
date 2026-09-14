export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getApprovedPublicReviews } from "@/lib/public-reviews-list";

export async function GET() {
  try {
    const rows = await getApprovedPublicReviews();

    const reviews = rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      productId: r.itemHref.slice("/products/".length),
      productName: r.itemName,
      verifiedPurchase: r.verifiedPurchase,
    }));

    const totalCount = reviews.length;
    const averageRating =
      totalCount > 0
        ? Math.round(
            (reviews.reduce((s, x) => s + x.rating, 0) / totalCount) * 10
          ) / 10
        : 0;

    return NextResponse.json({
      reviews,
      averageRating,
      totalCount,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load reviews" },
      { status: 500 }
    );
  }
}
