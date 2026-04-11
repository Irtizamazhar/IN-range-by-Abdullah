export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ORDER_INCLUDE_REVIEW } from "@/lib/prisma-order-includes";
import { prisma } from "@/lib/prisma";
import {
  isOrderDeliveredForReview,
  orderEmailsMatch,
  orderHasProductLine,
} from "@/lib/order-review-eligibility";
import { orderProductReviewExists } from "@/lib/review-stats";
import { getCustomerSession } from "@/lib/sessions";

type Ctx = { params: { orderId: string; productId: string } };

export async function GET(_req: Request, context: Ctx) {
  const { orderId, productId } = context.params;
  const oid = String(orderId || "").trim();
  const pid = String(productId || "").trim();
  if (!oid || !pid) {
    return NextResponse.json({ error: "orderId and productId required" }, { status: 400 });
  }

  const session = await getCustomerSession();
  if (session?.user?.role !== "customer" || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionEmail = String(session.user.email).trim().toLowerCase();

  const order = await prisma.order.findUnique({
    where: { id: oid },
    include: ORDER_INCLUDE_REVIEW,
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!orderEmailsMatch(order.customerEmail, sessionEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!orderHasProductLine(order, pid)) {
    return NextResponse.json(
      { error: "Product not in order" },
      { status: 400 }
    );
  }

  const delivered = isOrderDeliveredForReview(order);
  const reviewed = await orderProductReviewExists(order.id, pid);

  return NextResponse.json({
    reviewed,
    eligible: delivered,
  });
}
