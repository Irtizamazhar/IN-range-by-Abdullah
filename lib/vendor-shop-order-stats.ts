import { prisma } from "@/lib/prisma";

export function startOfTodayPK(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Widget numbers for a single vendor dashboard. */
export async function getVendorShopStats(vendorId: string) {
  const t0 = startOfTodayPK();
  const [ordersToday, pending, shipped, cancelled] = await Promise.all([
    prisma.vendorShopOrder.count({
      where: { vendorId, placedAt: { gte: t0 } },
    }),
    prisma.vendorShopOrder.count({
      where: { vendorId, status: "pending" },
    }),
    prisma.vendorShopOrder.count({
      where: { vendorId, status: "shipped" },
    }),
    prisma.vendorShopOrder.count({
      where: { vendorId, status: "cancelled" },
    }),
  ]);
  return { ordersToday, pending, shipped, cancelled };
}

/** Marketplace-wide shop-order counts (admin). */
export async function getAdminShopStats() {
  const t0 = startOfTodayPK();
  const [ordersToday, pending, shipped, cancelled] = await Promise.all([
    prisma.vendorShopOrder.count({ where: { placedAt: { gte: t0 } } }),
    prisma.vendorShopOrder.count({ where: { status: "pending" } }),
    prisma.vendorShopOrder.count({ where: { status: "shipped" } }),
    prisma.vendorShopOrder.count({ where: { status: "cancelled" } }),
  ]);
  return { ordersToday, pending, shipped, cancelled };
}
