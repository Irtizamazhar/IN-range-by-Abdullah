import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { newArrivalsWindowStart } from "@/lib/product-new-arrival-window";

/** Most products the homepage "All Products" section shows. */
export const HOME_ALL_PRODUCTS_LIMIT = 12;

type ProductReader = { product: { findMany: typeof prisma.product.findMany } };

/**
 * Homepage "All Products": only products that have completed their 14-day (336-hour)
 * New Arrivals period, newest first. Younger products are never used to fill the
 * section, and Best Seller status has no influence on it.
 */
export function homeAllProductsWhere(now: Date = new Date()): Prisma.ProductWhereInput {
  return { isActive: true, createdAt: { lt: newArrivalsWindowStart(now) } };
}

export function homeAllProductRows(now: Date = new Date(), db: ProductReader = prisma) {
  return db.product.findMany({
    where: homeAllProductsWhere(now),
    orderBy: { createdAt: "desc" },
    take: HOME_ALL_PRODUCTS_LIMIT,
    select: catalogProductSelect(),
  });
}
