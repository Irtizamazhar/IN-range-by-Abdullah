import { prisma } from "@/lib/prisma";
import { giftTerms } from "@/lib/gift-products";

export type SearchKind = "products" | "services" | "gifts" | "requests" | "stores" | "categories";
export type SearchItem = { id: string; kind: SearchKind; title: string; detail: string; href: string };

export function normalizeSearchQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 100);
}

export async function searchPublicMarketplace(rawQuery: string, perGroup = 8): Promise<SearchItem[]> {
  const query = normalizeSearchQuery(rawQuery);
  if (query.length < 2) return [];
  const take = Math.min(20, Math.max(1, perGroup));
  const tokens = query.split(" ").slice(0, 5);
  const productMatch = tokens.map((token) => ({ OR: [
    { name: { contains: token } }, { description: { contains: token } }, { category: { contains: token } },
  ] }));
  const serviceMatch = tokens.map((token) => ({ OR: [
    { name: { contains: token } }, { description: { contains: token } }, { type: { contains: token } },
  ] }));
  const requestMatch = tokens.map((token) => ({ OR: [
    { title: { contains: token } }, { category: { contains: token } }, { description: { contains: token } },
  ] }));
  const [products, gifts, services, categories, serviceCategories, wants, stores] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true, AND: productMatch, NOT: { OR: giftTerms.flatMap((term) => [{ category: { contains: term } }, { name: { contains: term } }]) } }, select: { id: true, name: true, category: true }, take, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ where: { isActive: true, stock: { gt: 0 }, AND: [
      { OR: giftTerms.flatMap((term) => [{ category: { contains: term } }, { name: { contains: term } }]) },
      ...productMatch,
    ] }, select: { id: true, name: true, category: true }, take, orderBy: { createdAt: "desc" } }),
    prisma.serviceOffering.findMany({ where: { active: true, moderationStatus: "APPROVED", vendor: { status: "approved" }, AND: serviceMatch }, select: { id: true, name: true, type: true }, take, orderBy: { createdAt: "desc" } }),
    prisma.category.findMany({ where: { isActive: true, OR: [{ name: { contains: query } }, { slug: { contains: query } }] }, select: { id: true, name: true }, take, orderBy: { sortOrder: "asc" } }),
    prisma.serviceOffering.findMany({ where: { active: true, moderationStatus: "APPROVED", vendor: { status: "approved" }, type: { contains: query } }, select: { type: true }, distinct: ["type"], take }),
    prisma.want.findMany({ where: { status: "OPEN", expiresAt: { gt: new Date() }, customer: { isActive: true }, AND: requestMatch }, select: { id: true, title: true, category: true, requestType: true }, take, orderBy: { createdAt: "desc" } }),
    prisma.vendor.findMany({ where: { status: "approved", OR: [{ shopName: { contains: query } }, { primaryCategory: { contains: query } }] }, select: { id: true, shopName: true, storeSlug: true, primaryCategory: true }, take, orderBy: { createdAt: "desc" } }),
  ]);
  return [
    ...categories.map((row) => ({ id: row.id, kind: "categories" as const, title: row.name, detail: "Product category", href: `/products?category=${encodeURIComponent(row.name)}` })),
    ...serviceCategories.map((row) => ({ id: row.type, kind: "categories" as const, title: row.type, detail: "Service category", href: `/services?category=${encodeURIComponent(row.type)}` })),
    ...products.map((row) => ({ id: row.id, kind: "products" as const, title: row.name, detail: row.category, href: `/products/${encodeURIComponent(row.id)}` })),
    ...gifts.map((row) => ({ id: row.id, kind: "gifts" as const, title: row.name, detail: row.category, href: `/products/${encodeURIComponent(row.id)}` })),
    ...services.map((row) => ({ id: row.id, kind: "services" as const, title: row.name, detail: row.type, href: `/services/${encodeURIComponent(row.id)}` })),
    ...wants.map((row) => ({ id: row.id, kind: "requests" as const, title: row.title, detail: `${row.requestType} · ${row.category}`, href: `/wants/${encodeURIComponent(row.id)}` })),
    ...stores.map((row) => ({ id: row.id, kind: "stores" as const, title: row.shopName, detail: row.primaryCategory, href: `/stores/${encodeURIComponent(row.storeSlug || row.id)}` })),
  ];
}
