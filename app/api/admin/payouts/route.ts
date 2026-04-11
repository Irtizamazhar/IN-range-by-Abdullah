export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [
    withdrawals,
    pendingCount,
    pendingAndApprovedSum,
    paidThisMonthAgg,
    commissionMonthAgg,
  ] = await Promise.all([
    prisma.vendorWithdrawal.findMany({
      orderBy: { requestedAt: "desc" },
      take: 200,
      include: {
        vendor: {
          select: { id: true, shopName: true, ownerName: true, email: true },
        },
      },
    }),
    prisma.vendorWithdrawal.count({
      where: { status: "pending" },
    }),
    prisma.vendorWithdrawal.aggregate({
      where: { status: { in: ["pending", "approved"] } },
      _sum: { requestedAmount: true },
    }),
    prisma.vendorWithdrawal.aggregate({
      where: {
        status: "paid",
        processedAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { requestedAmount: true },
    }),
    prisma.vendorEarning.aggregate({
      where: {
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { commissionAmount: true },
    }),
  ]);

  return NextResponse.json({
    stats: {
      pendingRequestCount: pendingCount,
      totalRequestedAmountPendingAndApproved: Number(
        pendingAndApprovedSum._sum.requestedAmount ?? 0
      ),
      paidThisMonth: Number(paidThisMonthAgg._sum.requestedAmount ?? 0),
      commissionEarnedThisMonth: Number(
        commissionMonthAgg._sum.commissionAmount ?? 0
      ),
    },
    withdrawals: withdrawals.map((w) => ({
      id: w.id,
      vendorId: w.vendorId,
      shopName: w.vendor.shopName,
      ownerName: w.vendor.ownerName,
      email: w.vendor.email,
      requestedAmount: Number(w.requestedAmount),
      bankName: w.bankName,
      accountTitle: w.accountTitle,
      accountNumber: w.accountNumber,
      notes: w.notes,
      status: w.status,
      rejectionReason: w.rejectionReason,
      adminNote: w.adminNote,
      requestedAt: w.requestedAt.toISOString(),
      processedAt: w.processedAt?.toISOString() ?? null,
    })),
  });
}
