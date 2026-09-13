export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/sessions";
import { findOrderByIdOrNumber } from "@/lib/find-order";
import { cancelParentOrder } from "@/lib/order-cancellation-service";
import { notifyAdminOrderCancelled, notifyCustomerOrderCancelled } from "@/lib/order-emails";
import { ORDER_INCLUDE_SERIALIZE } from "@/lib/prisma-order-includes";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { serializeOrder } from "@/lib/serialize";
import { createVendorNotification } from "@/lib/vendor-notifications";
import { customerOwnsRecord } from "@/lib/order-ownership";

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, context: Ctx) {
  const session = await getCustomerSession();
  if (session?.user?.role !== "customer" || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestedReason = "Customer cancelled order";
  try {
    const body = (await req.json()) as { reason?: unknown };
    if (body.reason) requestedReason = String(body.reason);
  } catch {
    // Existing clients sent no body; keep the safe default reason.
  }
  const reason = sanitizePlainText(requestedReason, 500);

  const order = await findOrderByIdOrNumber(context.params.id);
  if (!order || !customerOwnsRecord(order.customerId, session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await cancelParentOrder({
    orderId: order.id,
    reason,
    actorType: "customer",
    actorId: session.user.id,
    customerId: session.user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const fresh = await prisma.order.findUnique({
    where: { id: order.id },
    include: ORDER_INCLUDE_SERIALIZE,
  });
  if (!fresh) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const out = serializeOrder(fresh);

  if (!result.alreadyCancelled) {
    const vendorSlices = await prisma.vendorShopOrder.findMany({
      where: { orderId: order.id },
      select: { vendorId: true, shopOrderNumber: true },
    });
    for (const slice of vendorSlices) {
      await createVendorNotification({
        vendorId: slice.vendorId,
        type: "order_cancelled",
        title: "Order cancelled",
        message: `Order ${slice.shopOrderNumber} was cancelled by the customer.`,
      });
    }
    await notifyAdminOrderCancelled({
      orderNumber: out.orderNumber,
      customerName: out.customerName,
      customerEmail: out.customerEmail,
      totalAmount: out.totalAmount,
    });
    await notifyCustomerOrderCancelled({
      orderNumber: out.orderNumber,
      customerName: out.customerName,
      customerEmail: out.customerEmail,
      totalAmount: out.totalAmount,
    });
  }

  return NextResponse.json(out, {
    headers: result.alreadyCancelled ? { "X-Idempotent-Replay": "true" } : {},
  });
}
