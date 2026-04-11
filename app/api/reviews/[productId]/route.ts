export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  getApprovedReviewsForProduct,
  getProductReviewDashboard,
  type ApprovedReviewRow,
} from "@/lib/review-stats";

type Ctx = { params: { productId: string } };

export async function GET(_req: NextRequest, context: Ctx) {
  const { productId } = context.params;
  const id = String(productId || "").trim();
  if (!id) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  try {
    const [reviewsRaw, dash] = await Promise.all([
      getApprovedReviewsForProduct(id),
      getProductReviewDashboard(id),
    ]);
    const reviews = reviewsRaw.map((r: ApprovedReviewRow) => ({
      id: String(r.id),
      name: r.name,
      rating: r.rating,
      comment: r.comment,
      imageUrl: r.imageUrl ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
    return NextResponse.json({
      reviews,
      averageRating: dash.averageRating,
      totalCount: dash.totalCount,
      breakdown: dash.breakdown,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load reviews" },
      { status: 500 }
    );
  }
}
