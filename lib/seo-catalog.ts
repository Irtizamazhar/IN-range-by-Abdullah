import { requestCache as cache } from "@/lib/seo-cache";
import type { Prisma } from "@prisma/client";
import type { ProductCardData } from "@/components/user/ProductCard";
import { prisma } from "@/lib/prisma";
import { indexableProductWhere } from "@/lib/seo-data";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { serializeProduct } from "@/lib/serialize";
import { pickReviewStat, reviewStatsForProductIds } from "@/lib/review-stats";
import { readCatalogFilters } from "@/app/(user)/products/catalog-filter-state";

export type InitialCatalog = { key: string; products: ProductCardData[]; page: number; total: number; totalPages: number; categories: string[]; priceRange: { min: number; max: number } };
export const catalogParams = (values: Record<string, string | string[] | undefined> = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (typeof value === "string") params.set(key, value);
  return params;
};
export const readSeoCatalog = cache(async (query: string): Promise<InitialCatalog | null> => {
  const params = new URLSearchParams(query), filters = readCatalogFilters(params);
  const page = Number(params.get("page") || "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return null;
  const search = (params.get("search") || "").slice(0, 200);
  const where: Prisma.ProductWhereInput = { AND: [indexableProductWhere], ...(filters.category ? { category: filters.category } : {}),
    ...(search ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] } : {}),
    ...(filters.minPrice !== null || filters.maxPrice !== null ? { price: { ...(filters.minPrice !== null ? { gte: filters.minPrice } : {}), ...(filters.maxPrice !== null ? { lte: filters.maxPrice } : {}) } } : {}),
    ...(filters.inStock ? { stock: { gt: 0 } } : {}),
  };
  const order: Prisma.ProductOrderByWithRelationInput = filters.sort === "price_asc" ? { price: "asc" } : filters.sort === "price_desc" ? { price: "desc" } : { createdAt: "desc" };
  const [rows, total, categories, prices] = await Promise.all([
    prisma.product.findMany({ where, orderBy: [order, { id: "asc" }], take: 18, skip: (page - 1) * 18, select: catalogProductSelect() }),
    prisma.product.count({ where }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true }, take: 1000 }),
    prisma.product.aggregate({ where: indexableProductWhere, _min: { price: true }, _max: { price: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / 18));
  if (page > totalPages) return null;
  const stats = await reviewStatsForProductIds(rows.map(row => row.id));
  const products = rows.map(row => ({ ...serializeProduct(row), ...pickReviewStat(stats, row.id) }));
  const key = new URLSearchParams();
  if (search) key.set("search", search);
  if (filters.category) key.set("category", filters.category);
  if (filters.minPrice !== null) key.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== null) key.set("maxPrice", String(filters.maxPrice));
  if (filters.inStock) key.set("inStock", "true");
  key.set("sort", filters.sort);
  return { key: key.toString(), products, page, total, totalPages, categories: categories.map(row => row.name), priceRange: { min: Number(prices._min.price ?? 0), max: Number(prices._max.price ?? 0) } };
});
