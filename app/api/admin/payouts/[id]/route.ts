export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import {
  markEarningsPaidForWithdrawal,
  releaseWithdrawalAllocations,
} from "@/lib/vendor-earning-service";
import { createVendorNotification } from "@/lib/vendor-notifications";
import {
  sendVendorWithdrawalApprovedEmail,
  sendVendorWithdrawalPaidEmail,
  sendVendorWithdrawalRejectedEmail,
} from "@/lib/vendor-mail";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("mark_paid"),
    transferReference: z.string().min(3).max(191),
  }),
  z.object({
    action: z.literal("reject"),
    rejectionReason: z.string().min(1).max(2000),
    adminNote: z.string().max(2000).optional(),
  }),
]);

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdminPermission("payouts.manage");
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const w = await prisma.vendorWithdrawal.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, email: true, shopName: true } },
    },
  });
  if (!w) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    if (parsed.data.action === "approve") {
      if (w.status !== "pending") {
        return NextResponse.json(
          { error: "Only pending requests can be approved" },
          { status: 400 }
        );
      }
      await prisma.$transaction(async (tx) => {
        const gate = await tx.vendorWithdrawal.updateMany({
          where: { id, status: "pending" },
          data: { status: "approved" },
        });
        if (gate.count !== 1) throw new Error("Request status changed");
        await writeAdminAudit(tx, { adminId: auth.admin.id, action: "payout_approved", entityType: "VendorWithdrawal", entityId: id, details: { amount: Number(w.requestedAmount), vendorId: w.vendorId } });
      });
      await createVendorNotification({
        vendorId: w.vendorId,
        type: "withdrawal_approved",
        title: "Withdrawal approved",
        message: `Your withdrawal request of Rs. ${Number(w.requestedAmount).toLocaleString("en-PK")} has been approved and will be transferred soon.`,
      });
      await sendVendorWithdrawalApprovedEmail(
        w.vendor.email,
        Number(w.requestedAmount)
      );
      return NextResponse.json({ ok: true, status: "approved" });
    }

    if (parsed.data.action === "mark_paid") {
      if (w.status !== "approved") {
        return NextResponse.json(
          { error: "Approve the request before marking as paid" },
          { status: 400 }
        );
      }

      const transferReference = sanitizePlainText(
        parsed.data.transferReference,
        191
      );

      await prisma.$transaction(async (tx) => {
        await markEarningsPaidForWithdrawal(
          {
            withdrawalId: w.id,
            vendorId: w.vendorId,
            requestedAmount: Number(w.requestedAmount),
            transferReference,
          },
          tx
        );
        const gate = await tx.vendorWithdrawal.updateMany({
          where: { id, status: "approved" },
          data: {
            status: "paid",
            processedAt: new Date(),
            transferReference,
            openKey: null,
          },
        });
        if (gate.count !== 1) throw new Error("Payout was already processed");
        await writeAdminAudit(tx, { adminId: auth.admin.id, action: "payout_paid", entityType: "VendorWithdrawal", entityId: id, details: { amount: Number(w.requestedAmount), transferReference } });
      });

      await createVendorNotification({
        vendorId: w.vendorId,
        type: "withdrawal_paid",
        title: "Withdrawal paid",
        message: `Rs. ${Number(w.requestedAmount).toLocaleString("en-PK")} has been marked as transferred to your bank account.`,
      });
      await sendVendorWithdrawalPaidEmail(
        w.vendor.email,
        Number(w.requestedAmount)
      );
      return NextResponse.json({ ok: true, status: "paid" });
    }

    // reject
    if (w.status === "paid") {
      return NextResponse.json({ error: "Cannot reject a paid request" }, { status: 400 });
    }
    const reason = sanitizePlainText(parsed.data.rejectionReason, 2000);
    const adminNote = parsed.data.adminNote
      ? sanitizePlainText(parsed.data.adminNote, 2000)
      : null;

    await prisma.$transaction(async (tx) => {
      await releaseWithdrawalAllocations(tx, {
        withdrawalId: w.id,
        vendorId: w.vendorId,
        requestedAmount: Number(w.requestedAmount),
      });
      const gate = await tx.vendorWithdrawal.updateMany({
        where: { id, status: { in: ["pending", "approved"] } },
        data: {
          status: "rejected",
          rejectionReason: reason,
          adminNote,
          processedAt: new Date(),
          openKey: null,
        },
      });
      if (gate.count !== 1) throw new Error("Request status changed");
      await writeAdminAudit(tx, { adminId: auth.admin.id, action: "payout_rejected", entityType: "VendorWithdrawal", entityId: id, details: { amount: Number(w.requestedAmount), reason } });
    });

    await createVendorNotification({
      vendorId: w.vendorId,
      type: "withdrawal_rejected",
      title: "Withdrawal not completed",
      message: reason,
    });
    await sendVendorWithdrawalRejectedEmail(
      w.vendor.email,
      Number(w.requestedAmount),
      reason
    );
    return NextResponse.json({ ok: true, status: "rejected" });
  } catch (e) {
    console.error("PATCH /api/admin/payouts/[id]", e);
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
