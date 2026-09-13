export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;

  const orders = await prisma.order.findMany({
    where: {
      customerId: auth.customer.id,
      OR: [
        { orderStatus: "delivered" },
        { vendorShopOrders: { some: { status: "delivered" } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      orderItems: {
        include: {
          inventoryLine: {
            include: {
              vendorProduct: { select: { vendorId: true } },
              vendorShopOrder: { select: { status: true, updatedAt: true } },
            },
          },
          returnRequests: {
            where: {
              status: {
                in: [
                  "requested",
                  "vendor_approved",
                  "return_in_transit",
                  "received",
                  "refund_pending",
                  "refunded",
                ],
              },
            },
            select: { id: true, quantity: true, status: true },
          },
          warranty: {
            select: { id: true, quantity: true, startsAt: true, expiresAt: true, status: true },
          },
        },
      },
    },
  });

  return NextResponse.json({
    items: orders.flatMap((order) =>
      order.orderItems
      .filter((item) => item.inventoryLine?.vendorShopOrder
        ? item.inventoryLine.vendorShopOrder.status === "delivered"
        : order.orderStatus === "delivered")
      .map((item) => ({
        id: item.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        deliveredAt: (
          item.inventoryLine?.vendorShopOrder?.updatedAt ?? order.updatedAt
        ).toISOString(),
        name: item.name,
        image: item.image,
        variant: item.variant,
        unitPrice: Number(item.price),
        quantity: item.quantity,
        vendorId: item.inventoryLine?.vendorProduct?.vendorId ?? null,
        sellerDeliveryStatus: item.inventoryLine?.vendorShopOrder?.status ?? null,
        returnedQuantity: item.returnRequests.reduce(
          (sum, request) => sum + request.quantity,
          0
        ),
        activeReturn: item.returnRequests[0] ?? null,
        warranty: item.warranty
          ? {
              ...item.warranty,
              startsAt: item.warranty.startsAt.toISOString(),
              expiresAt: item.warranty.expiresAt.toISOString(),
            }
          : null,
      }))
    ),
  });
}
