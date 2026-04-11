import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Create a single VendorEarning when a VendorShopOrder is marked delivered.
 * Idempotent via unique vendorShopOrderId.
 */
export async function createVendorEarningForDeliveredShopOrder(
  vendorShopOrderId: string
): Promise<{ created: boolean; earningId?: string }> {
  const shop = await prisma.vendorShopOrder.findUnique({
    where: { id: vendorShopOrderId },
    include: {
      lineOrders: true,
      order: { select: { id: true } },
    },
  });
  if (!shop || shop.status !== "delivered") {
    return { created: false };
  }

  const existing = await prisma.vendorEarning.findUnique({
    where: { vendorShopOrderId },
  });
  if (existing) {
    return { created: false, earningId: existing.id };
  }

  let gross = 0;
  let commission = 0;
  let net = 0;

  if (shop.lineOrders.length > 0) {
    for (const line of shop.lineOrders) {
      const sale = Number(line.saleAmount);
      const comm = Number(line.commissionAmount);
      const v = Number(line.vendorAmount);
      gross += sale;
      commission += comm;
      net += v;
    }
  } else {
    gross = Number(shop.totalAmount);
    commission = Number(shop.commissionAmount);
    net = Number(shop.netAmount);
  }

  const avgRate =
    gross > 0 ? Math.round(((commission / gross) * 100 + Number.EPSILON) * 100) / 100 : 0;

  try {
    const row = await prisma.vendorEarning.create({
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
    return { created: true, earningId: row.id };
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: unknown }).code)
        : "";
    if (code === "P2002") {
      return { created: false };
    }
    throw e;
  }
}

export async function sumPendingEarningsNet(vendorId: string): Promise<number> {
  const agg = await prisma.vendorEarning.aggregate({
    where: { vendorId, status: "pending" },
    _sum: { vendorAmount: true },
  });
  return Number(agg._sum.vendorAmount ?? 0);
}

export async function sumPaidWithdrawals(vendorId: string): Promise<number> {
  const agg = await prisma.vendorWithdrawal.aggregate({
    where: { vendorId, status: "paid" },
    _sum: { requestedAmount: true },
  });
  return Number(agg._sum.requestedAmount ?? 0);
}

export async function hasOpenWithdrawalRequest(vendorId: string): Promise<boolean> {
  const n = await prisma.vendorWithdrawal.count({
    where: {
      vendorId,
      status: { in: ["pending", "approved"] },
    },
  });
  return n > 0;
}

/**
 * FIFO-allocate pending earnings until cumulative net >= requestedAmount; mark those as paid.
 */
export async function markEarningsPaidForWithdrawal(
  params: {
    vendorId: string;
    requestedAmount: number;
  },
  db: Db = prisma
): Promise<{ ids: string[]; allocated: number }> {
  const { vendorId, requestedAmount } = params;
  const pending = await db.vendorEarning.findMany({
    where: { vendorId, status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  let sum = 0;
  const ids: string[] = [];
  const target = Math.round(requestedAmount * 100) / 100;

  for (const e of pending) {
    if (sum >= target) break;
    const v = Number(e.vendorAmount);
    sum = Math.round((sum + v) * 100) / 100;
    ids.push(e.id);
  }

  if (sum < target) {
    throw new Error("Insufficient pending earnings to cover this withdrawal");
  }

  await db.vendorEarning.updateMany({
    where: { id: { in: ids } },
    data: { status: "paid" },
  });

  return { ids, allocated: sum };
}
