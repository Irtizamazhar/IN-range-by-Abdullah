export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import {
  markEarningsPaidForWithdrawal,
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
  }),
  z.object({
    action: z.literal("reject"),
    rejectionReason: z.string().min(1).max(2000),
    adminNote: z.string().max(2000).optional(),
  }),
]);

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      await prisma.vendorWithdrawal.update({
        where: { id },
        data: { status: "approved" },
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

      await prisma.$transaction(async (tx) => {
        await markEarningsPaidForWithdrawal(
          {
            vendorId: w.vendorId,
            requestedAmount: Number(w.requestedAmount),
          },
          tx
        );
        await tx.vendorWithdrawal.update({
          where: { id },
          data: {
            status: "paid",
            processedAt: new Date(),
          },
        });
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

    await prisma.vendorWithdrawal.update({
      where: { id },
      data: {
        status: "rejected",
        rejectionReason: reason,
        adminNote,
        processedAt: new Date(),
      },
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
