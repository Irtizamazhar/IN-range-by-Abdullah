import type { Prisma } from "@prisma/client";
import { releaseReservedInventory } from "@/lib/order-inventory-service";

/** An order with a refund or with vendor earnings already allocated to a payout is financial history and is kept. */
const LOCKED: Prisma.OrderWhereInput = {
  OR: [
    { refunds: { some: {} } },
    { vendorEarnings: { some: { payoutAllocations: { some: {} } } } },
    { vendorShopOrders: { some: { vendorEarning: { is: { payoutAllocations: { some: {} } } } } } },
    { services: { some: { earning: { is: { payoutAllocations: { some: {} } } } } } },
  ],
};

/**
 * Permanently deletes the given orders. Reserved stock is returned and coupon usage is given back first;
 * order-only records (items, shop orders, events, returns, disputes, warranties, services, earnings) go with the order.
 * Products, customers and vendors are never deleted. Returns deleted ids and how many locked orders were skipped.
 */
export async function deleteOrders(tx: Prisma.TransactionClient, ids: string[]) {
  const [rows, skipped] = await Promise.all([
    tx.order.findMany({ where: { id: { in: ids }, NOT: LOCKED }, select: { id: true } }),
    tx.order.count({ where: { id: { in: ids }, ...LOCKED } }),
  ]);
  const deleted = rows.map((row) => row.id);
  if (!deleted.length) return { deleted, skipped };
  const inOrders = { orderId: { in: deleted } };

  for (const id of deleted) await releaseReservedInventory(tx, { orderId: id }, "Order deleted by admin.");

  const redemptions = await tx.couponRedemption.findMany({ where: inOrders, select: { couponId: true } });
  for (const { couponId } of redemptions) {
    await tx.vendorCoupon.updateMany({ where: { id: couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
  }
  await tx.couponRedemption.deleteMany({ where: inOrders });

  // A Want quote outlives its order so the Want itself stays intact (and becomes deletable again).
  await tx.offerQuote.updateMany({ where: inOrders, data: { orderId: null } });

  const earnings = await tx.vendorEarning.findMany({
    where: { OR: [inOrders, { vendorShopOrder: inOrders }, { orderService: inOrders }] },
    select: { id: true },
  });
  const earningIds = earnings.map((earning) => earning.id);
  if (earningIds.length) {
    await tx.vendorLedgerEntry.deleteMany({ where: { earningId: { in: earningIds } } });
    await tx.vendorEarning.deleteMany({ where: { id: { in: earningIds } } });
  }

  await tx.serviceEvent.deleteMany({ where: { orderService: inOrders } });
  await tx.orderService.deleteMany({ where: inOrders });
  await tx.dispute.deleteMany({ where: inOrders });
  await tx.returnRequest.deleteMany({ where: inOrders });
  await tx.warrantyRecord.deleteMany({ where: inOrders });
  await tx.order.deleteMany({ where: { id: { in: deleted } } });
  return { deleted, skipped };
}
