import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateExactCents, fromCents, toCents } from "@/lib/payout-allocation";

type Db = Prisma.TransactionClient | typeof prisma;

/** Create the earning and its immutable credit entry exactly once. */
export async function createVendorEarningForDeliveredShopOrder(
  vendorShopOrderId: string
): Promise<{ created: boolean; earningId?: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const shop = await tx.vendorShopOrder.findUnique({
        where: { id: vendorShopOrderId },
        include: { lineOrders: true },
      });
      if (!shop || shop.status !== "delivered") return { created: false };

      const existing = await tx.vendorEarning.findUnique({
        where: { vendorShopOrderId },
      });
      if (existing) return { created: false, earningId: existing.id };

      let gross = 0;
      let commission = 0;
      let net = 0;
      if (shop.lineOrders.length) {
        for (const line of shop.lineOrders) {
          gross += Number(line.saleAmount);
          commission += Number(line.commissionAmount);
          net += Number(line.vendorAmount);
        }
      } else {
        gross = Number(shop.totalAmount);
        commission = Number(shop.commissionAmount);
        net = Number(shop.netAmount);
      }
      const avgRate = gross > 0 ? Math.round((commission / gross) * 10_000) / 100 : 0;

      const earning = await tx.vendorEarning.create({
        data: {
          vendorId: shop.vendorId,
          orderId: shop.orderId,
          vendorShopOrderId: shop.id,
          saleAmount: new Prisma.Decimal(gross.toFixed(2)),
          commissionRate: new Prisma.Decimal(avgRate.toFixed(2)),
          commissionAmount: new Prisma.Decimal(commission.toFixed(2)),
          vendorAmount: new Prisma.Decimal(net.toFixed(2)),
          status: "pending",
        },
      });
      await tx.vendorLedgerEntry.create({
        data: {
          vendorId: shop.vendorId,
          earningId: earning.id,
          type: "earning_credit",
          amount: earning.vendorAmount,
          idempotencyKey: `earning:${earning.id}`,
          details: { vendorShopOrderId: shop.id },
        },
      });
      return { created: true, earningId: earning.id };
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    if (code === "P2002") return { created: false };
    throw error;
  }
}

export async function sumPendingEarningsNet(vendorId: string): Promise<number> {
  const [rows, legacyOpen, refundDebits] = await Promise.all([
    prisma.vendorEarning.findMany({
      where: { vendorId, status: { in: ["pending", "cleared"] } },
      select: { vendorAmount: true, reservedAmount: true, paidAmount: true },
    }),
    prisma.vendorWithdrawal.findMany({
      where: { vendorId, openKey: vendorId, payoutAllocations: { none: {} } },
      select: { requestedAmount: true },
    }),
    prisma.vendorLedgerEntry.aggregate({
      where: { vendorId, type: "refund_debit" },
      _sum: { amount: true },
    }),
  ]);
  const earningCents = rows.reduce(
      (sum, row) =>
        sum +
        Math.max(
          0,
          toCents(row.vendorAmount.toString()) -
            toCents(row.reservedAmount.toString()) -
            toCents(row.paidAmount.toString())
        ),
      0
    );
  const legacyReservedCents = legacyOpen.reduce(
    (sum, row) => sum + toCents(row.requestedAmount.toString()),
    0
  );
  const refundDebtCents = Math.max(
    0,
    -toCents(refundDebits._sum.amount?.toString() ?? "0")
  );
  return fromCents(
    Math.max(0, earningCents - legacyReservedCents - refundDebtCents)
  );
}

export async function sumPaidWithdrawals(vendorId: string): Promise<number> {
  const agg = await prisma.vendorWithdrawal.aggregate({
    where: { vendorId, status: "paid" },
    _sum: { requestedAmount: true },
  });
  return Number(agg._sum.requestedAmount ?? 0);
}

export async function hasOpenWithdrawalRequest(vendorId: string): Promise<boolean> {
  return (await prisma.vendorWithdrawal.count({ where: { openKey: vendorId } })) > 0;
}

type WithdrawalBankSnapshot = {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
};

async function allocateWithdrawal(
  tx: Prisma.TransactionClient,
  params: { vendorId: string; withdrawalId: string; requestedCents: number }
) {
  const earnings = await tx.vendorEarning.findMany({
    where: { vendorId: params.vendorId, status: { in: ["pending", "cleared"] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const refundDebits = await tx.vendorLedgerEntry.aggregate({
    where: { vendorId: params.vendorId, type: "refund_debit" },
    _sum: { amount: true },
  });
  const refundDebtCents = Math.max(
    0,
    -toCents(refundDebits._sum.amount?.toString() ?? "0")
  );
  const grossAvailableCents = earnings.reduce(
    (sum, earning) =>
      sum +
      Math.max(
        0,
        toCents(earning.vendorAmount.toString()) -
          toCents(earning.reservedAmount.toString()) -
          toCents(earning.paidAmount.toString())
      ),
    0
  );
  if (params.requestedCents > Math.max(0, grossAvailableCents - refundDebtCents)) {
    throw new Error("Amount exceeds available balance after refund adjustments");
  }
  const allocations = allocateExactCents(
    earnings.map((earning) => ({
      id: earning.id,
      availableCents: Math.max(
        0,
        toCents(earning.vendorAmount.toString()) -
          toCents(earning.reservedAmount.toString()) -
          toCents(earning.paidAmount.toString())
      ),
    })),
    params.requestedCents
  );

  for (const allocation of allocations) {
    const earning = earnings.find((row) => row.id === allocation.earningId)!;
    const amount = new Prisma.Decimal(fromCents(allocation.amountCents).toFixed(2));
    const gate = await tx.vendorEarning.updateMany({
      where: {
        id: earning.id,
        reservedAmount: earning.reservedAmount,
        paidAmount: earning.paidAmount,
      },
      data: { reservedAmount: { increment: amount } },
    });
    if (gate.count !== 1) throw new Error("Balance changed; please retry");
    await tx.payoutAllocation.create({
      data: {
        withdrawalId: params.withdrawalId,
        earningId: earning.id,
        amount,
        status: "reserved",
      },
    });
  }

  await tx.vendorLedgerEntry.create({
    data: {
      vendorId: params.vendorId,
      withdrawalId: params.withdrawalId,
      type: "withdrawal_reserved",
      amount: new Prisma.Decimal((-fromCents(params.requestedCents)).toFixed(2)),
      idempotencyKey: `withdrawal-reserved:${params.withdrawalId}`,
      details: { allocationCount: allocations.length },
    },
  });
}

export async function createWithdrawalWithAllocations(params: {
  vendorId: string;
  requestedAmount: number;
  bank: WithdrawalBankSnapshot;
  notes?: string | null;
}) {
  const requestedCents = toCents(params.requestedAmount);
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.vendorWithdrawal.findFirst({
        where: { openKey: params.vendorId },
        select: { id: true },
      });
      if (existing) throw new Error("You already have a pending or approved withdrawal request");

      const withdrawal = await tx.vendorWithdrawal.create({
        data: {
          vendorId: params.vendorId,
          requestedAmount: new Prisma.Decimal(params.requestedAmount.toFixed(2)),
          bankName: params.bank.bankName,
          accountTitle: params.bank.accountTitle,
          accountNumber: params.bank.accountNumber,
          notes: params.notes || null,
          status: "pending",
          openKey: params.vendorId,
        },
      });
      await allocateWithdrawal(tx, {
        vendorId: params.vendorId,
        withdrawalId: withdrawal.id,
        requestedCents,
      });
      return withdrawal;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

/** Legacy approved withdrawals get exact allocations just before settlement. */
async function ensureWithdrawalAllocations(
  tx: Prisma.TransactionClient,
  params: { withdrawalId: string; vendorId: string; requestedAmount: number }
) {
  const count = await tx.payoutAllocation.count({
    where: { withdrawalId: params.withdrawalId },
  });
  if (count > 0) return;
  await allocateWithdrawal(tx, {
    vendorId: params.vendorId,
    withdrawalId: params.withdrawalId,
    requestedCents: toCents(params.requestedAmount),
  });
}

export async function markEarningsPaidForWithdrawal(
  params: {
    withdrawalId: string;
    vendorId: string;
    requestedAmount: number;
    transferReference: string;
  },
  db: Db = prisma
): Promise<{ ids: string[]; allocated: number }> {
  if (!("payoutAllocation" in db)) throw new Error("Invalid database client");
  const tx = db as Prisma.TransactionClient;
  await ensureWithdrawalAllocations(tx, params);
  const allocations = await tx.payoutAllocation.findMany({
    where: { withdrawalId: params.withdrawalId, status: "reserved" },
    include: { earning: true },
  });
  const allocatedCents = allocations.reduce(
    (sum, row) => sum + toCents(row.amount.toString()),
    0
  );
  if (allocatedCents !== toCents(params.requestedAmount)) {
    throw new Error("Payout allocation does not match the withdrawal amount");
  }

  for (const allocation of allocations) {
    const amount = allocation.amount;
    const newPaidCents =
      toCents(allocation.earning.paidAmount.toString()) +
      toCents(amount.toString());
    const fullyPaid = newPaidCents >= toCents(allocation.earning.vendorAmount.toString());
    const gate = await tx.payoutAllocation.updateMany({
      where: { id: allocation.id, status: "reserved" },
      data: { status: "paid" },
    });
    if (gate.count !== 1) throw new Error("Payout was already processed");
    await tx.vendorEarning.update({
      where: { id: allocation.earningId },
      data: {
        reservedAmount: { decrement: amount },
        paidAmount: { increment: amount },
        status: fullyPaid ? "paid" : allocation.earning.status,
      },
    });
  }
  await tx.vendorLedgerEntry.create({
    data: {
      vendorId: params.vendorId,
      withdrawalId: params.withdrawalId,
      type: "withdrawal_paid",
      amount: new Prisma.Decimal(0),
      idempotencyKey: `withdrawal-paid:${params.withdrawalId}`,
      details: {
        amount: params.requestedAmount,
        transferReference: params.transferReference,
      },
    },
  });
  return {
    ids: allocations.map((row) => row.earningId),
    allocated: fromCents(allocatedCents),
  };
}

export async function releaseWithdrawalAllocations(
  tx: Prisma.TransactionClient,
  params: { withdrawalId: string; vendorId: string; requestedAmount: number }
) {
  const allocations = await tx.payoutAllocation.findMany({
    where: { withdrawalId: params.withdrawalId, status: "reserved" },
  });
  for (const allocation of allocations) {
    const gate = await tx.payoutAllocation.updateMany({
      where: { id: allocation.id, status: "reserved" },
      data: { status: "released" },
    });
    if (gate.count !== 1) continue;
    await tx.vendorEarning.update({
      where: { id: allocation.earningId },
      data: { reservedAmount: { decrement: allocation.amount } },
    });
  }
  if (allocations.length) {
    await tx.vendorLedgerEntry.create({
      data: {
        vendorId: params.vendorId,
        withdrawalId: params.withdrawalId,
        type: "withdrawal_released",
        amount: new Prisma.Decimal(params.requestedAmount.toFixed(2)),
        idempotencyKey: `withdrawal-released:${params.withdrawalId}`,
      },
    });
  }
}
