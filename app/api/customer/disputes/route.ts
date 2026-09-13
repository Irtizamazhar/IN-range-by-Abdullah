export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DISPUTE_INCLUDE, isPrismaUniqueError, serializeDispute } from "@/lib/after-sales";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  orderId: z.string().min(1),
  returnRequestId: z.string().min(1).optional(),
  type: z.enum(["order", "payment", "delivery", "return", "refund", "other"]),
  message: z.string().trim().min(10).max(4000),
});

export async function GET() {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  const rows = await prisma.dispute.findMany({
    where: { customerId: auth.customer.id },
    orderBy: { createdAt: "desc" },
    include: DISPUTE_INCLUDE,
  });
  return NextResponse.json({ disputes: rows.map(serializeDispute) });
}

export async function POST(req: NextRequest) {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid dispute" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findFirst({
    where: { id: parsed.data.orderId, customerId: auth.customer.id },
    include: {
      vendorShopOrders: { select: { vendorId: true }, take: 2 },
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  let linkedReturn: { id: string; vendorId: string | null } | null = null;
  if (parsed.data.returnRequestId) {
    linkedReturn = await prisma.returnRequest.findFirst({
      where: { id: parsed.data.returnRequestId, customerId: auth.customer.id, orderId: order.id },
      select: { id: true, vendorId: true },
    });
    if (!linkedReturn) {
      return NextResponse.json({ error: "Return request not found" }, { status: 404 });
    }
  }

  const vendorId = linkedReturn?.vendorId ??
    (order.vendorShopOrders.length === 1 ? order.vendorShopOrders[0].vendorId : null);
  const scope = linkedReturn ? `return:${linkedReturn.id}` : `order:${order.id}:${parsed.data.type}`;
  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          customerId: auth.customer.id,
          orderId: order.id,
          returnRequestId: linkedReturn?.id ?? null,
          vendorId,
          type: parsed.data.type,
          message: parsed.data.message,
          activeKey: `${auth.customer.id}:${scope}`,
        },
        include: DISPUTE_INCLUDE,
      });
      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          actorType: "customer",
          actorId: auth.customer.id,
          eventType: "dispute_opened",
          idempotencyKey: `dispute-opened:${created.id}`,
          details: { disputeId: created.id, type: created.type },
        },
      });
      return created;
    });
    return NextResponse.json({ dispute: serializeDispute(row) }, { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json(
        { error: "An active dispute already exists for this order or return" },
        { status: 409 }
      );
    }
    console.error("POST /api/customer/disputes", error);
    return NextResponse.json({ error: "Could not open dispute" }, { status: 500 });
  }
}
