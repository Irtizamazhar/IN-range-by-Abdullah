export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";
import {
  hasOpenWithdrawalRequest,
  sumPendingEarningsNet,
} from "@/lib/vendor-earning-service";

const MIN_WITHDRAWAL = 500;

const postSchema = z.object({
  requestedAmount: z.number().positive(),
  notes: z.string().max(2000).optional(),
});

export async function GET() {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const rows = await prisma.vendorWithdrawal.findMany({
    where: { vendorId: auth.vendor.id },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    withdrawals: rows.map((w) => ({
      id: w.id,
      requestedAmount: Number(w.requestedAmount),
      status: w.status,
      bankName: w.bankName,
      accountTitle: w.accountTitle,
      accountNumber: w.accountNumber,
      notes: w.notes,
      rejectionReason: w.rejectionReason,
      adminNote: w.adminNote,
      requestedAt: w.requestedAt.toISOString(),
      processedAt: w.processedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.requestedAmount?.[0] || "Invalid body" },
      { status: 400 }
    );
  }

  const amount = Math.round(parsed.data.requestedAmount * 100) / 100;
  if (amount < MIN_WITHDRAWAL) {
    return NextResponse.json(
      { error: `Minimum withdrawal is Rs. ${MIN_WITHDRAWAL}` },
      { status: 400 }
    );
  }

  if (await hasOpenWithdrawalRequest(auth.vendor.id)) {
    return NextResponse.json(
      { error: "You already have a pending or approved withdrawal request" },
      { status: 400 }
    );
  }

  const available = await sumPendingEarningsNet(auth.vendor.id);
  if (amount > available + 0.009) {
    return NextResponse.json(
      {
        error: `Amount exceeds available balance (Rs. ${available.toLocaleString("en-PK")})`,
      },
      { status: 400 }
    );
  }

  const v = await prisma.vendor.findUnique({
    where: { id: auth.vendor.id },
    select: {
      bankName: true,
      accountTitle: true,
      accountNumber: true,
    },
  });
  if (!v?.bankName || !v.accountTitle || !v.accountNumber) {
    return NextResponse.json(
      { error: "Complete your bank details in Settings before requesting a withdrawal" },
      { status: 400 }
    );
  }

  try {
    const w = await prisma.vendorWithdrawal.create({
      data: {
        vendorId: auth.vendor.id,
        requestedAmount: new Prisma.Decimal(amount.toFixed(2)),
        bankName: v.bankName,
        accountTitle: v.accountTitle,
        accountNumber: v.accountNumber,
        notes: parsed.data.notes?.trim() || null,
        status: "pending",
      },
    });

    return NextResponse.json({
      ok: true,
      id: w.id,
      requestedAmount: amount,
      status: w.status,
    });
  } catch (e) {
    console.error("POST /api/vendor/withdrawals", e);
    return NextResponse.json({ error: "Could not create withdrawal" }, { status: 500 });
  }
}
