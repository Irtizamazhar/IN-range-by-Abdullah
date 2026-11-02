import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { catalogProductSelect } from "@/lib/catalog-product-select";

/** Most products the homepage "All Products" section shows. */
export const HOME_ALL_PRODUCTS_LIMIT = 12;

type ProductReader = { product: { findMany: typeof prisma.product.findMany } };

/**
 * Homepage "All Products": every active product, newest first, including ones still in
 * their 14-day New Arrivals period (their cards carry a "New" tag until it ends).
 * Best Seller status has no influence on it.
 */
export const homeAllProductsWhere: Prisma.ProductWhereInput = { isActive: true };

export function homeAllProductRows(db: ProductReader = prisma) {
  return db.product.findMany({
    where: homeAllProductsWhere,
    orderBy: { createdAt: "desc" },
    take: HOME_ALL_PRODUCTS_LIMIT,
    select: catalogProductSelect(),
  });
}
