import { prisma } from "@/lib/prisma";
import { indexableProductWhere } from "@/lib/seo-data";
import { productPath } from "@/lib/catalog-urls";
import { normalizeSearchQuery, type SearchItem } from "@/lib/public-search";

export type SearchSuggestion = SearchItem & { image?: string; price?: number; originalPrice?: number | null };
export function suggestionQuery(value: string) {
  return normalizeSearchQuery(value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " "));
}
/** Two bounded, public-only reads. No popularity claims, personal data or image blobs. */
export async function readSearchSuggestions(raw: string): Promise<SearchSuggestion[]> {
  const query = suggestionQuery(raw);
  const tokens = query.split(" ").filter(Boolean).slice(0, 5);
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { AND: [indexableProductWhere, ...tokens.map(token => ({ OR: [{ name: { contains: token } }, { category: { contains: token } }, { description: { contains: token } }] }))] },
      select: { id: true, slug: true, name: true, category: true, price: true, originalPrice: true, listingImageUrls: true, productImages: { select: { id: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
      orderBy: [...(!query ? [{ isFeatured: "desc" as const }] : []), { createdAt: "desc" }, { id: "asc" }], take: 6,
    }),
    prisma.category.findMany({ where: { isActive: true, products: { some: indexableProductWhere }, ...(query ? { OR: [{ name: { contains: query } }, { slug: { contains: query } }] } : {}) }, select: { id: true, name: true, slug: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 3 }),
  ]);
  return [
    ...products.map(row => ({ id: row.id, kind: "products" as const, title: row.name, detail: row.category, href: productPath(row), price: Number(row.price), originalPrice: row.originalPrice == null ? null : Number(row.originalPrice), image: (Array.isArray(row.listingImageUrls) ? row.listingImageUrls.find(url => typeof url === "string" && url.trim()) as string | undefined : undefined) || (row.productImages[0] ? `/api/image/${row.productImages[0].id}` : undefined) })),
    ...categories.map(row => ({ id: row.id, kind: "categories" as const, title: row.name, detail: "Category", href: `/categories/${encodeURIComponent(row.slug)}` })),
  ];
}
