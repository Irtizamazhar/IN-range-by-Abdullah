export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { findOrderByIdOrNumber } from "@/lib/find-order";
import { notifyAdminOrderCancelled, notifyCustomerOrderCancelled } from "@/lib/order-emails";
import { ORDER_INCLUDE_SERIALIZE } from "@/lib/prisma-order-includes";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serialize";
import { cancelVendorShopOrder } from "@/lib/vendor-shop-order-service";
import { createVendorNotification } from "@/lib/vendor-notifications";

type Ctx = { params: { id: string } };

const BLOCK_CANCEL: string[] = ["packing", "shipped", "delivered", "cancelled"];

export async function POST(_req: NextRequest, context: Ctx) {
  const { id } = context.params;
  const order = await findOrderByIdOrNumber(id);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (BLOCK_CANCEL.includes(order.orderStatus)) {
    return NextResponse.json(
      { error: "This order can no longer be cancelled" },
      { status: 403 }
    );
  }

  const vendorSlices = await prisma.vendorShopOrder.findMany({
    where: { orderId: order.id },
    select: { id: true, vendorId: true, shopOrderNumber: true, status: true },
  });
  for (const s of vendorSlices) {
    if (s.status === "delivered" || s.status === "cancelled") continue;
    const res = await cancelVendorShopOrder({
      shopOrderId: s.id,
      reason: "Customer cancelled order",
    });
    if (res.ok) {
      await createVendorNotification({
        vendorId: s.vendorId,
        type: "order_cancelled",
        title: "Order cancelled",
        message: `Order ${s.shopOrderNumber} was cancelled by the customer.`,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const line of order.orderItems) {
      if (line.productId) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { increment: line.quantity } },
        });
      }
    }
    await tx.order.update({
      where: { id: order.id },
      data: { orderStatus: "cancelled" },
    });
  });

  const fresh = await prisma.order.findUnique({
    where: { id: order.id },
    include: ORDER_INCLUDE_SERIALIZE,
  });
  if (!fresh) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const out = serializeOrder(fresh);
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

  return NextResponse.json(out);
}
