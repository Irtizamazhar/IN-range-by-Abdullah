import type { Prisma } from "@prisma/client";

/**
 * Explicit Product columns for storefront / catalog queries.
 * Avoids Prisma default `SELECT *` against databases where legacy columns were removed
 * (e.g. `isNewArrival`) while an outdated generated client might still reference them.
 *
 * Nested `productImages` only loads `id` + `sortOrder` (no image blobs).
 */
export function catalogProductSelect(
  imageArgs?: { take?: number }
): Prisma.ProductSelect {
  return {
    id: true,
    name: true,
    description: true,
    price: true,
    originalPrice: true,
    discountPercent: true,
    category: true,
    stock: true,
    variants: true,
    isActive: true,
    listingImageUrls: true,
    createdAt: true,
    updatedAt: true,
    productImages: {
      orderBy: { sortOrder: "asc" },
      select: { id: true, sortOrder: true },
      ...(imageArgs?.take != null ? { take: imageArgs.take } : {}),
    },
  };
}
