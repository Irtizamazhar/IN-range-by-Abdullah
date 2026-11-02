import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { serializeProduct } from "@/lib/serialize";
import type { ProductCardData } from "@/components/user/ProductCard";

/** Keywords that mark a commission category as gift-type (admin commission settings only). */
export const giftTerms = ["gift", "flower", "bouquet", "hamper", "birthday", "anniversary", "wedding"];

/**
 * The product categories that make up Gifts. A product is a gift only when its assigned
 * category is one of these; its title, description and keywords never make it one.
 * Categories have no parent/child links, so list every gift category by its exact name.
 */
export const GIFT_CATEGORY_NAMES = ["Gifts, Parties & Celebrations"];

/** Products whose assigned category is a Gifts category. */
export const giftCategoryWhere: Prisma.ProductWhereInput = { category: { in: GIFT_CATEGORY_NAMES } };

export async function giftProducts(filters: { search?: string; category?: string; take?: number } = {}): Promise<ProductCardData[]> {
  const { search = "", category = "", take = 48 } = filters;
  const products = await prisma.product.findMany({
    where: {
      isActive: true, stock: { gt: 0 },
      AND: [
        giftCategoryWhere,
        ...(search ? [{ OR: [{ name: { contains: search } }, { description: { contains: search } }] }] : []),
        // A category filter narrows within the gift categories; a non-gift category matches nothing.
        ...(category ? [{ category }] : []),
      ],
    },
    select: catalogProductSelect(), orderBy: { createdAt: "desc" }, take: Math.min(100, Math.max(1, take)),
  });
  return products.map(product => serializeProduct(product) as ProductCardData);
}
