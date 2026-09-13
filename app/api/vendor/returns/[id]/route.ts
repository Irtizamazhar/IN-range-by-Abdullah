export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RETURN_INCLUDE, serializeReturn } from "@/lib/after-sales";
import { prisma } from "@/lib/prisma";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { createCustomerNotification } from "@/lib/customer-notifications";

const schema = z.object({
  action: z.enum(["approve", "reject", "received"]),
  note: z.string().trim().max(3000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid return action" }, { status: 400 });
  }
  if (parsed.data.action === "reject" && !parsed.data.note) {
    return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
  }

  const expected = parsed.data.action === "received" ? "return_in_transit" : "requested";
  const next = parsed.data.action === "approve"
    ? "vendor_approved"
    : parsed.data.action === "reject"
      ? "vendor_rejected"
      : "received";

  try {
    const row = await prisma.$transaction(
      async (tx) => {
        const gate = await tx.returnRequest.updateMany({
          where: { id: params.id, vendorId: auth.vendor.id, status: expected },
          data: {
            status: next,
            vendorNote: parsed.data.note || null,
            reviewedAt: parsed.data.action === "received" ? undefined : new Date(),
            receivedAt: parsed.data.action === "received" ? new Date() : undefined,
            activeKey: parsed.data.action === "reject" ? null : undefined,
          },
        });
        if (gate.count !== 1) throw new Error("INVALID_STATE");
        const updated = await tx.returnRequest.findUniqueOrThrow({
          where: { id: params.id },
          include: RETURN_INCLUDE,
        });
        await tx.orderStatusEvent.create({
          data: {
            orderId: updated.orderId,
            actorType: "vendor",
            actorId: auth.vendor.id,
            eventType: `return_${parsed.data.action}`,
            idempotencyKey: `return-${parsed.data.action}:${updated.id}`,
            details: { returnRequestId: updated.id },
          },
        });
        await createCustomerNotification({
          customerId: updated.customerId,
          type: "return_update",
          title: `Return ${parsed.data.action === "received" ? "received" : parsed.data.action === "approve" ? "approved" : "not approved"}`,
          message: `${updated.order.orderNumber}: ${updated.orderItem.name}${parsed.data.note ? ` — ${parsed.data.note}` : ""}`,
          link: "/my-stuff",
          idempotencyKey: `return-${parsed.data.action}:${updated.id}:customer`,
        }, tx);
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return NextResponse.json({ return: serializeReturn(row) });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_STATE") {
      return NextResponse.json(
        { error: "Return not found or its status has already changed" },
        { status: 409 }
      );
    }
    console.error("PATCH /api/vendor/returns/[id]", error);
    return NextResponse.json({ error: "Could not update return" }, { status: 500 });
  }
}
