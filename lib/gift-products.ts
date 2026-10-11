import { prisma } from "@/lib/prisma";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { serializeProduct } from "@/lib/serialize";
import type { ProductCardData } from "@/components/user/ProductCard";

export const giftTerms = ["gift", "flower", "bouquet", "hamper", "birthday", "anniversary", "wedding"];

export async function giftProducts(filters: { search?: string; category?: string; take?: number } = {}): Promise<ProductCardData[]> {
  const { search = "", category = "", take = 48 } = filters;
  const products = await prisma.product.findMany({
    where: {
      isActive: true, stock: { gt: 0 },
      OR: giftTerms.flatMap(term => [{ category: { contains: term } }, { name: { contains: term } }]),
      ...(search ? { AND: [{ OR: [{ name: { contains: search } }, { description: { contains: search } }] }] } : {}),
      ...(category ? { category } : {}),
    },
    select: catalogProductSelect(), orderBy: { createdAt: "desc" }, take: Math.min(100, Math.max(1, take)),
  });
  return products.map(product => serializeProduct(product) as ProductCardData);
}
