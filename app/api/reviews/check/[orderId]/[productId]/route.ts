export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ORDER_INCLUDE_REVIEW } from "@/lib/prisma-order-includes";
import { prisma } from "@/lib/prisma";
import { isReviewOrderEligible } from "@/lib/order-review-eligibility";
import { reviewPhotoUrlForCustomer } from "@/lib/review-policy";
import { getCustomerSession } from "@/lib/sessions";

type Ctx = { params: { orderId: string; productId: string } };

export async function GET(_request: Request, context: Ctx) {
  const orderId = String(context.params.orderId || "").trim();
  const productId = String(context.params.productId || "").trim();
  if (!orderId || !productId) {
    return NextResponse.json(
      { error: "orderId and productId required" },
      { status: 400 }
    );
  }

  const session = await getCustomerSession();
  if (session?.user?.role !== "customer" || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE_REVIEW,
  });
  if (!order || order.customerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const eligible = isReviewOrderEligible(
    order,
    session.user.id,
    productId
  );
  const review = await prisma.review.findFirst({
    where: {
      customerId: session.user.id,
      productId,
      withdrawn: false,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      rating: true,
      comment: true,
      imageUrl: true,
      approved: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    review: review
      ? {
          id: String(review.id),
          rating: review.rating,
          comment: review.comment,
          imageUrl:
            review.imageUrl &&
            reviewPhotoUrlForCustomer(review.imageUrl, session.user.id)
              ? review.imageUrl
              : null,
          approved: review.approved,
          updatedAt: review.updatedAt.toISOString(),
        }
      : null,
    reviewed: Boolean(review),
    eligible,
  });
}
