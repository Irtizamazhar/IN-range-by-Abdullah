export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ORDER_INCLUDE_REVIEW } from "@/lib/prisma-order-includes";
import { prisma } from "@/lib/prisma";
import { readProducts } from "@/lib/products-store";
import {
  isOrderDeliveredForReview,
  orderEmailsMatch,
  orderHasProductLine,
} from "@/lib/order-review-eligibility";
import { getCustomerSession } from "@/lib/sessions";
import {
  createPendingNewArrivalReview,
  getApprovedReviewsForNewArrival,
  getNewArrivalReviewDashboard,
  type ApprovedNewArrivalReviewRow,
} from "../../../lib/new-arrival-review-stats";
import {
  createApprovedOrderReview,
  createPendingReview,
  getApprovedReviewsForProduct,
  getProductReviewDashboard,
  orderProductReviewExists,
  type ApprovedReviewRow,
} from "@/lib/review-stats";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const newArrivalIdRaw = searchParams.get("newArrivalId");
  if (newArrivalIdRaw != null && String(newArrivalIdRaw).trim() !== "") {
    const newArrivalId = parseInt(String(newArrivalIdRaw).trim(), 10);
    if (!Number.isFinite(newArrivalId)) {
      return NextResponse.json({ error: "Invalid newArrivalId" }, { status: 400 });
    }
    try {
      const [reviewsRaw, dash] = await Promise.all([
        getApprovedReviewsForNewArrival(newArrivalId),
        getNewArrivalReviewDashboard(newArrivalId),
      ]);
      const reviews = reviewsRaw.map((r: ApprovedNewArrivalReviewRow) => ({
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

  const productId = String(searchParams.get("productId") || "").trim();
  if (!productId) {
    return NextResponse.json(
      { error: "productId or newArrivalId is required" },
      { status: 400 }
    );
  }

  try {
    const [reviewsRaw, dash] = await Promise.all([
      getApprovedReviewsForProduct(productId),
      getProductReviewDashboard(productId),
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

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderIdBody = String(body.orderId || "").trim();
  if (orderIdBody) {
    const session = await getCustomerSession();
    if (session?.user?.role !== "customer" || !session.user?.email) {
      return NextResponse.json(
        { error: "Sign in with the account used for this order to leave a review." },
        { status: 401 }
      );
    }

    const productIdVerified = String(body.productId || "").trim();
    const ratingVerified = Number(body.rating);
    const commentVerified = String(body.comment || "").trim();
    const imageUrlBody = String(body.imageUrl || "").trim();

    if (!productIdVerified) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    if (!Number.isFinite(ratingVerified) || ratingVerified < 1 || ratingVerified > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    const sessionEmail = String(session.user.email).trim().toLowerCase();
    const customer = await prisma.customer.findUnique({
      where: { email: sessionEmail },
    });
    if (!customer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const order = await prisma.order.findUnique({
        where: { id: orderIdBody },
        include: ORDER_INCLUDE_REVIEW,
      });
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      if (!orderEmailsMatch(order.customerEmail, sessionEmail)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!isOrderDeliveredForReview(order)) {
        return NextResponse.json(
          { error: "You can only review products from delivered orders." },
          { status: 403 }
        );
      }
      if (!orderHasProductLine(order, productIdVerified)) {
        return NextResponse.json(
          { error: "This product is not part of that order." },
          { status: 400 }
        );
      }
      if (await orderProductReviewExists(order.id, productIdVerified)) {
        return NextResponse.json(
          { error: "You already reviewed this product for this order." },
          { status: 409 }
        );
      }

      const product = await prisma.product.findFirst({
        where: { id: productIdVerified, isActive: true },
        select: { id: true },
      });
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      let verifiedImageUrl: string | null = null;
      if (imageUrlBody) {
        if (
          !imageUrlBody.startsWith("/uploads/reviews/") ||
          imageUrlBody.includes("..")
        ) {
          return NextResponse.json(
            { error: "Invalid review photo. Upload again from this page." },
            { status: 400 }
          );
        }
        verifiedImageUrl = imageUrlBody.slice(0, 2048);
      }

      await createApprovedOrderReview({
        productId: productIdVerified,
        orderId: order.id,
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        rating: Math.round(ratingVerified),
        comment: commentVerified.length > 0 ? commentVerified : "—",
        imageUrl: verifiedImageUrl,
      });

      return NextResponse.json({
        success: true,
        message: "Thank you for your review! ✅",
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "You already reviewed this product for this order." },
          { status: 409 }
        );
      }
      console.error(e);
      return NextResponse.json(
        { error: "Could not save review" },
        { status: 500 }
      );
    }
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const commentRaw = String(body.comment || "").trim();
  const comment = commentRaw.length > 0 ? commentRaw : "—";
  const imageUrl = String(body.imageUrl || "").trim();
  const productId = String(body.productId || "").trim();
  const newArrivalIdRaw = body.newArrivalId;
  const rating = Number(body.rating);

  if (!name || !email) {
    return NextResponse.json(
      { error: "Name and email are required" },
      { status: 400 }
    );
  }
  if (!imageUrl) {
    return NextResponse.json(
      { error: "Please upload a photo of the product you received" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be between 1 and 5" },
      { status: 400 }
    );
  }

  const hasNewArrival =
    newArrivalIdRaw !== undefined &&
    newArrivalIdRaw !== null &&
    String(newArrivalIdRaw).trim() !== "";

  try {
    if (hasNewArrival) {
      const newArrivalId = Number(newArrivalIdRaw);
      if (!Number.isFinite(newArrivalId)) {
        return NextResponse.json({ error: "Invalid newArrivalId" }, { status: 400 });
      }
      const products = await readProducts();
      if (!products.some((p) => p.id === newArrivalId)) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      await createPendingNewArrivalReview({
        name,
        email,
        rating: Math.round(rating),
        comment,
        newArrivalId,
        imageUrl,
      });
    } else {
      if (!productId) {
        return NextResponse.json(
          { error: "productId or newArrivalId is required" },
          { status: 400 }
        );
      }
      const product = await prisma.product.findFirst({
        where: { id: productId, isActive: true },
        select: { id: true },
      });
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      await createPendingReview({
        name,
        email,
        rating: Math.round(rating),
        comment,
        productId,
        imageUrl,
      });
    }

    return NextResponse.json({
      success: true,
      message:
        "Thank you! Your review was submitted and is pending approval before it appears publicly.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save review" },
      { status: 500 }
    );
  }
}
