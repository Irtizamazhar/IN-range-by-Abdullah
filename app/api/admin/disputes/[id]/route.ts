export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DISPUTE_INCLUDE, serializeDispute } from "@/lib/after-sales";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { createCustomerNotification } from "@/lib/customer-notifications";

const schema = z.object({
  status: z.enum(["under_review", "resolved", "rejected"]),
  resolution: z.string().trim().max(4000).optional(),
}).superRefine((value, ctx) => {
  if (["resolved", "rejected"].includes(value.status) && !value.resolution) {
    ctx.addIssue({ code: "custom", path: ["resolution"], message: "A resolution is required" });
  }
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdminPermission("disputes.manage");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid dispute action" },
      { status: 400 }
    );
  }
  const terminal = parsed.data.status === "resolved" || parsed.data.status === "rejected";
  try {
    const row = await prisma.$transaction(async (tx) => {
      const current = await tx.dispute.findUnique({ where: { id: params.id } });
      if (!current) throw new Error("NOT_FOUND");
      if (["resolved", "rejected"].includes(current.status)) throw new Error("INVALID_STATE");
      const updated = await tx.dispute.update({
        where: { id: current.id },
        data: {
          status: parsed.data.status,
          resolution: parsed.data.resolution || null,
          activeKey: terminal ? null : undefined,
          resolvedAt: terminal ? new Date() : null,
        },
        include: DISPUTE_INCLUDE,
      });
      await tx.orderStatusEvent.create({
        data: {
          orderId: current.orderId,
          actorType: "admin",
          actorId: auth.admin.id,
          eventType: `dispute_${parsed.data.status}`,
          idempotencyKey: `dispute-${parsed.data.status}:${current.id}`,
          details: { disputeId: current.id, resolution: parsed.data.resolution || null },
        },
      });
      await createCustomerNotification({
        customerId: current.customerId,
        type: "dispute_update",
        title: `Dispute ${parsed.data.status.replaceAll("_", " ")}`,
        message: parsed.data.resolution || "Your case is now being reviewed.",
        link: "/my-stuff",
        idempotencyKey: `dispute-${parsed.data.status}:${current.id}:customer`,
      }, tx);
      return updated;
    });
    return NextResponse.json({ dispute: serializeDispute(row) });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "INVALID_STATE") {
      return NextResponse.json({ error: "This dispute is already closed" }, { status: 409 });
    }
    console.error("PATCH /api/admin/disputes/[id]", error);
    return NextResponse.json({ error: "Could not update dispute" }, { status: 500 });
  }
}
