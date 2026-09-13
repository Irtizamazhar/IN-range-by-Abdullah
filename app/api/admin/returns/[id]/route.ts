export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RETURN_INCLUDE, serializeReturn } from "@/lib/after-sales";
import { prisma } from "@/lib/prisma";
import { createPendingRefund, processManualRefund } from "@/lib/refund-service";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { createCustomerNotification } from "@/lib/customer-notifications";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_refund"),
    amount: z.number().positive(),
    note: z.string().trim().max(3000).optional(),
  }),
  z.object({
    action: z.literal("process_refund"),
    refundId: z.string().min(1),
    externalRef: z.string().trim().min(3).max(191),
    note: z.string().trim().max(3000).optional(),
    restock: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("close"),
    note: z.string().trim().min(3).max(3000),
  }),
  z.object({
    action: z.enum(["approve_return", "mark_received", "reject_return"]),
    note: z.string().trim().max(3000).optional(),
  }).superRefine((value, ctx) => {
    if (value.action === "reject_return" && !value.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "A rejection reason is required" });
    }
  }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminPermission("returns.manage");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid action" },
      { status: 400 }
    );
  }
  const adminId = auth.admin.id;

  try {
    if (parsed.data.action === "create_refund") {
      await createPendingRefund({
        returnRequestId: params.id,
        amount: parsed.data.amount,
        adminId,
        adminNote: parsed.data.note,
      });
    } else if (parsed.data.action === "process_refund") {
      const linked = await prisma.refund.findFirst({
        where: { id: parsed.data.refundId, returnRequestId: params.id },
        select: { id: true },
      });
      if (!linked) return NextResponse.json({ error: "Refund not found" }, { status: 404 });
      await processManualRefund({
        refundId: linked.id,
        externalRef: parsed.data.externalRef,
        adminId,
        adminNote: parsed.data.note,
        restock: parsed.data.restock,
      });
    } else if (parsed.data.action === "close") {
      const result = await prisma.$transaction(async (tx) => {
        const request = await tx.returnRequest.findUnique({
          where: { id: params.id },
          select: { orderId: true, status: true },
        });
        if (!request) throw new Error("NOT_FOUND");
        if (["refund_pending", "refunded"].includes(request.status)) {
          throw new Error("INVALID_STATE");
        }
        await tx.returnRequest.update({
          where: { id: params.id },
          data: {
            status: "closed",
            activeKey: null,
            closedAt: new Date(),
            adminNote: parsed.data.note,
          },
        });
        await tx.orderStatusEvent.create({
          data: {
            orderId: request.orderId,
            actorType: "admin",
            actorId: adminId,
            eventType: "return_closed",
            idempotencyKey: `return-closed:${params.id}`,
            details: { returnRequestId: params.id, note: parsed.data.note },
          },
        });
        const owner = await tx.returnRequest.findUniqueOrThrow({
          where: { id: params.id }, select: { customerId: true },
        });
        await createCustomerNotification({
          customerId: owner.customerId,
          type: "return_update",
          title: "Return case closed",
          message: parsed.data.note || "Return case closed.",
          link: "/my-stuff",
          idempotencyKey: `return-closed:${params.id}:customer`,
        }, tx);
        return true;
      });
      void result;
    } else {
      const expected = parsed.data.action === "mark_received" ? "return_in_transit" : "requested";
      const next = parsed.data.action === "approve_return"
        ? "vendor_approved"
        : parsed.data.action === "reject_return"
          ? "vendor_rejected"
          : "received";
      const updated = await prisma.$transaction(async (tx) => {
        const gate = await tx.returnRequest.updateMany({
          where: { id: params.id, status: expected },
          data: {
            status: next,
            adminNote: parsed.data.note || null,
            reviewedAt: parsed.data.action === "mark_received" ? undefined : new Date(),
            receivedAt: parsed.data.action === "mark_received" ? new Date() : undefined,
            activeKey: parsed.data.action === "reject_return" ? null : undefined,
          },
        });
        if (gate.count !== 1) throw new Error("INVALID_STATE");
        const request = await tx.returnRequest.findUniqueOrThrow({
          where: { id: params.id }, select: { orderId: true, customerId: true },
        });
        await tx.orderStatusEvent.create({
          data: {
            orderId: request.orderId,
            actorType: "admin",
            actorId: adminId,
            eventType: `return_${parsed.data.action}`,
            idempotencyKey: `return-${parsed.data.action}:${params.id}`,
            details: { returnRequestId: params.id, note: parsed.data.note || null },
          },
        });
        await createCustomerNotification({
          customerId: request.customerId,
          type: "return_update",
          title: parsed.data.action === "approve_return" ? "Return approved" : parsed.data.action === "mark_received" ? "Return received" : "Return not approved",
          message: parsed.data.note || `Status changed to ${next.replaceAll("_", " ")}.`,
          link: "/my-stuff",
          idempotencyKey: `return-${parsed.data.action}:${params.id}:customer`,
        }, tx);
        return true;
      });
      void updated;
    }
    const row = await prisma.returnRequest.findUniqueOrThrow({
      where: { id: params.id },
      include: RETURN_INCLUDE,
    });
    return NextResponse.json({ return: serializeReturn(row) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      NOT_FOUND: "Return request not found",
      INVALID_STATE: "This action is not valid for the current return status",
      INVALID_AMOUNT: "Enter a valid refund amount",
      AMOUNT_EXCEEDS_LINE: "Refund cannot exceed the returned item value",
      INVALID_REFERENCE: "A valid transfer reference is required",
      ALREADY_PROCESSED: "This refund was already processed with another reference",
      PAYMENT_NOT_RECEIVED: "Refund cannot be processed until the order payment is received",
    };
    if (messages[code]) {
      return NextResponse.json({ error: messages[code] }, { status: code === "NOT_FOUND" ? 404 : 409 });
    }
    console.error("PATCH /api/admin/returns/[id]", error);
    return NextResponse.json({ error: "Could not update return" }, { status: 500 });
  }
}
