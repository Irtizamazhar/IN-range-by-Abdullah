export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";
import {
  hasOpenWithdrawalRequest,
  sumPaidWithdrawals,
  sumPendingEarningsNet,
} from "@/lib/vendor-earning-service";

export async function GET() {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const vendorId = auth.vendor.id;

  const [earnings, aggAll, pendingWithdrawals, refundDebits] = await Promise.all([
    prisma.vendorEarning.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        order: { select: { orderNumber: true } },
        vendorShopOrder: { select: { shopOrderNumber: true } },
      },
    }),
    prisma.vendorEarning.aggregate({
      where: { vendorId },
      _sum: { vendorAmount: true, commissionAmount: true, saleAmount: true },
    }),
    prisma.vendorWithdrawal.findMany({
      where: {
        vendorId,
        status: { in: ["pending", "approved"] },
      },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.vendorLedgerEntry.aggregate({
      where: { vendorId, type: "refund_debit" },
      _sum: { amount: true },
    }),
  ]);

  const available = await sumPendingEarningsNet(vendorId);
  const withdrawnAllTime = await sumPaidWithdrawals(vendorId);

  const refundAdjustments = Math.abs(Number(refundDebits._sum.amount ?? 0));
  const totalNetAllTime = Math.max(
    0,
    Number(aggAll._sum.vendorAmount ?? 0) - refundAdjustments
  );

  return NextResponse.json({
    summary: {
      totalEarningsNet: totalNetAllTime,
      availableBalance: available,
      withdrawnAllTime,
      refundAdjustments,
      hasOpenWithdrawal: await hasOpenWithdrawalRequest(vendorId),
    },
    pendingWithdrawals: pendingWithdrawals.map((w) => ({
      id: w.id,
      requestedAmount: Number(w.requestedAmount),
      status: w.status,
      requestedAt: w.requestedAt.toISOString(),
    })),
    earnings: earnings.map((e) => ({
      id: e.id,
      orderNumber: e.order?.orderNumber ?? "—",
      shopOrderNumber: e.vendorShopOrder?.shopOrderNumber ?? null,
      grossAmount: Number(e.saleAmount),
      commissionAmount: Number(e.commissionAmount),
      netAmount: Number(e.vendorAmount),
      commissionRate: Number(e.commissionRate),
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
