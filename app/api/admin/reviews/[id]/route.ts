export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { ORDER_INCLUDE_REVIEW } from "@/lib/prisma-order-includes";
import { isPurchaseBackedReview } from "@/lib/product-review-stats-service";

type Ctx = { params: { id: string } };

function scopeFromUrl(url: string) {
  const scope = new URL(url).searchParams.get("scope");
  return scope === "newArrival" ? "newArrival" : "product";
}

function sameOriginResponse(request: Request) {
  const origin = request.headers.get("origin");
  return origin && origin !== new URL(request.url).origin
    ? NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 })
    : null;
}

function reviewId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;
  const crossOrigin = sameOriginResponse(request);
  if (crossOrigin) return crossOrigin;

  const id = reviewId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  let body: { approved?: boolean };
  try {
    body = (await request.json()) as { approved?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "approved boolean required" }, { status: 400 });
  }

  try {
    if (scopeFromUrl(request.url) === "newArrival") {
      if (body.approved) {
        return NextResponse.json(
          { error: "Legacy guest reviews cannot be verified or published." },
          { status: 409 }
        );
      }
      const updated = await prisma.$transaction(async (tx) => {
        const review = await tx.newArrivalReview.update({
          where: { id },
          data: { approved: false },
        });
        await writeAdminAudit(tx, {
          adminId: auth.admin.id,
          action: "legacy_review_hidden",
          entityType: "NewArrivalReview",
          entityId: String(id),
          details: { approved: false },
        });
        return review;
      });
      return NextResponse.json({
        ok: true,
        review: { id: updated.id, approved: false },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.review.findUnique({
        where: { id },
        include: { order: { include: ORDER_INCLUDE_REVIEW } },
      });
      if (!current) return null;
      if (body.approved && current.withdrawn) {
        throw new Error("WITHDRAWN_REVIEW");
      }
      if (body.approved && !isPurchaseBackedReview(current)) {
        throw new Error("UNVERIFIED_REVIEW");
      }
      const review = await tx.review.update({
        where: { id },
        data: { approved: body.approved },
        include: { product: { select: { name: true } } },
      });
      await writeAdminAudit(tx, {
        adminId: auth.admin.id,
        action: body.approved ? "review_approved" : "review_hidden",
        entityType: "Review",
        entityId: String(id),
        details: {
          approved: body.approved,
          customerId: current.customerId,
          orderId: current.orderId,
          productId: current.productId,
        },
      });
      return review;
    });
    if (!updated) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      review: {
        id: updated.id,
        approved: updated.approved,
        productName: updated.product.name,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WITHDRAWN_REVIEW") {
      return NextResponse.json(
        { error: "A customer-withdrawn review cannot be approved." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "UNVERIFIED_REVIEW") {
      return NextResponse.json(
        { error: "Only a purchase-verified review can be approved." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
}

/** Moderation removal is soft: history is retained and excluded from aggregates. */
export async function DELETE(request: NextRequest, context: Ctx) {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;
  const crossOrigin = sameOriginResponse(request);
  if (crossOrigin) return crossOrigin;
  const id = reviewId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const scope = scopeFromUrl(request.url);
    const changed = await prisma.$transaction(async (tx) => {
      if (scope === "newArrival") {
        const result = await tx.newArrivalReview.updateMany({
          where: { id },
          data: { approved: false },
        });
        if (!result.count) return false;
        await writeAdminAudit(tx, {
          adminId: auth.admin.id,
          action: "legacy_review_hidden",
          entityType: "NewArrivalReview",
          entityId: String(id),
        });
        return true;
      }
      const result = await tx.review.updateMany({
        where: { id },
        data: { approved: false, withdrawn: true },
      });
      if (!result.count) return false;
      await writeAdminAudit(tx, {
        adminId: auth.admin.id,
        action: "review_withdrawn_by_admin",
        entityType: "Review",
        entityId: String(id),
      });
      return true;
    });
    return changed
      ? NextResponse.json({ ok: true, withdrawn: true })
      : NextResponse.json({ error: "Review not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Could not withdraw review" }, { status: 500 });
  }
}
