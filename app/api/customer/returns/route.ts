export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { isPrismaUniqueError, RETURN_INCLUDE, serializeCustomerReturn } from "@/lib/after-sales";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  orderItemId: z.string().min(1),
  quantity: z.number().int().min(1).max(999),
  reason: z.string().trim().min(3).max(120),
  details: z.string().trim().max(3000).optional(),
});

export async function GET() {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;

  const rows = await prisma.returnRequest.findMany({
    where: { customerId: auth.customer.id },
    orderBy: { requestedAt: "desc" },
    include: RETURN_INCLUDE,
  });
  return NextResponse.json({ returns: rows.map(serializeCustomerReturn) });
}

export async function POST(req: NextRequest) {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid return request" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const item = await tx.orderItem.findFirst({
          where: {
            id: parsed.data.orderItemId,
            order: { customerId: auth.customer.id },
          },
          include: {
            order: { select: { id: true, orderStatus: true } },
            inventoryLine: {
              include: {
                vendorProduct: { select: { vendorId: true } },
                vendorShopOrder: { select: { status: true } },
              },
            },
          },
        });
        if (!item) throw new Error("NOT_FOUND");

        const delivered = item.inventoryLine?.vendorShopOrder
          ? item.inventoryLine.vendorShopOrder.status === "delivered"
          : item.order.orderStatus === "delivered";
        if (!delivered) throw new Error("NOT_DELIVERED");

        const used = await tx.returnRequest.aggregate({
          where: {
            orderItemId: item.id,
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
          _sum: { quantity: true },
        });
        if ((used._sum.quantity ?? 0) + parsed.data.quantity > item.quantity) {
          throw new Error("QUANTITY_EXCEEDED");
        }

        const created = await tx.returnRequest.create({
          data: {
            customerId: auth.customer.id,
            orderId: item.orderId,
            orderItemId: item.id,
            vendorId: item.inventoryLine?.vendorProduct?.vendorId ?? null,
            quantity: parsed.data.quantity,
            reason: parsed.data.reason,
            details: parsed.data.details || null,
            activeKey: `${auth.customer.id}:${item.id}`,
          },
          include: RETURN_INCLUDE,
        });

        await tx.orderStatusEvent.create({
          data: {
            orderId: item.orderId,
            actorType: "customer",
            actorId: auth.customer.id,
            eventType: "return_requested",
            idempotencyKey: `return-requested:${created.id}`,
            details: { returnRequestId: created.id, orderItemId: item.id },
          },
        });
        if (created.vendorId) {
          await tx.vendorNotification.create({
            data: {
              vendorId: created.vendorId,
              type: "return_requested",
              title: "New return request",
              message: `${created.order.orderNumber}: ${created.orderItem.name}`,
            },
          });
        }
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json({ return: serializeCustomerReturn(result) }, { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json(
        { error: "An active return request already exists for this item" },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "Order item not found" }, { status: 404 });
    }
    if (message === "NOT_DELIVERED") {
      return NextResponse.json(
        { error: "A return can only be requested after this item is delivered" },
        { status: 409 }
      );
    }
    if (message === "QUANTITY_EXCEEDED") {
      return NextResponse.json(
        { error: "Return quantity exceeds the remaining eligible quantity" },
        { status: 409 }
      );
    }
    console.error("POST /api/customer/returns", error);
    return NextResponse.json({ error: "Could not create return request" }, { status: 500 });
  }
}
