import { productPath } from "@/lib/catalog-urls";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SITE_URL, absoluteUrl } from "@/lib/seo";
import { indexableProductWhere, indexableServiceWhere, indexableStoreWhere, indexableWantWhere } from "@/lib/seo-data";

export const SITEMAP_PAGE_SIZE = 5000;
export const SITEMAP_KINDS = ["products", "categories", "services", "stores", "wants"] as const;
export type SitemapKind = typeof SITEMAP_KINDS[number];
export const STATIC_SEO_PATHS = ["/", "/products", "/categories", "/services", "/stores", "/wants", "/gifts", "/about", "/faq", "/reviews", "/return-policy"];
export const xmlEscape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
export function sitemapUrls(rows: { url: string; updatedAt?: Date | string }[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map(row => {
    const date = row.updatedAt ? new Date(row.updatedAt) : null;
    return `<url><loc>${xmlEscape(row.url)}</loc>${date && Number.isFinite(date.getTime()) ? `<lastmod>${date.toISOString()}</lastmod>` : ""}</url>`;
  }).join("")}</urlset>`;
}
export async function sitemapCounts() {
  const [products, categories, services, stores, wants] = await Promise.all([
    prisma.product.count({ where: indexableProductWhere }),
    prisma.category.count({ where: { isActive: true, products: { some: indexableProductWhere } } }),
    prisma.serviceOffering.count({ where: indexableServiceWhere }), prisma.vendor.count({ where: indexableStoreWhere }),
    prisma.want.count({ where: indexableWantWhere() }),
  ]);
  return { products, categories, services, stores, wants };
}
const cachedCounts = unstable_cache(sitemapCounts, ["seo-sitemap-counts-v1"], { revalidate: 60 });
export function sitemapIndex(counts: Record<SitemapKind, number>) {
  const paths = [`${SITE_URL}/sitemaps/static-0.xml`];
  for (const kind of SITEMAP_KINDS) {
    const pages = Math.ceil(counts[kind] / SITEMAP_PAGE_SIZE);
    if (!Number.isSafeInteger(pages) || pages < 0 || paths.length + pages > 45000) throw new Error("Sitemap capacity exceeded.");
    for (let i = 0; i < pages; i++) paths.push(`${SITE_URL}/sitemaps/${kind}-${i}.xml`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(url => `<sitemap><loc>${xmlEscape(url)}</loc></sitemap>`).join("")}</sitemapindex>`;
}
export const loadSitemapIndex = async () => sitemapIndex(await cachedCounts());

export async function sitemapRows(kind: SitemapKind, page: number) {
  const paging = { skip: page * SITEMAP_PAGE_SIZE, take: SITEMAP_PAGE_SIZE, orderBy: { id: "asc" as const } };
  if (kind === "products") return (await prisma.product.findMany({ ...paging, where: indexableProductWhere, select: { id: true, slug: true, updatedAt: true } })).map(row => ({ url: absoluteUrl(productPath(row)), updatedAt: row.updatedAt }));
  if (kind === "categories") return (await prisma.category.findMany({ ...paging, where: { isActive: true, products: { some: indexableProductWhere } }, select: { slug: true, updatedAt: true } })).map(row => ({ url: absoluteUrl(`/categories/${encodeURIComponent(row.slug)}`), updatedAt: row.updatedAt }));
  if (kind === "services") return (await prisma.serviceOffering.findMany({ ...paging, where: indexableServiceWhere, select: { id: true, updatedAt: true } })).map(row => ({ url: absoluteUrl(`/services/${encodeURIComponent(row.id)}`), updatedAt: row.updatedAt }));
  if (kind === "stores") return (await prisma.vendor.findMany({ ...paging, where: indexableStoreWhere, select: { id: true, storeSlug: true, updatedAt: true } })).map(row => ({ url: absoluteUrl(`/stores/${encodeURIComponent(row.storeSlug || row.id)}`), updatedAt: row.updatedAt }));
  return (await prisma.want.findMany({ ...paging, where: indexableWantWhere(), select: { id: true, updatedAt: true } })).map(row => ({ url: absoluteUrl(`/wants/${encodeURIComponent(row.id)}`), updatedAt: row.updatedAt }));
}
export async function loadSitemapPage(kind: SitemapKind, page: number) {
  const counts = await cachedCounts();
  if (page >= Math.ceil(counts[kind] / SITEMAP_PAGE_SIZE)) return null;
  const rows = await unstable_cache(() => sitemapRows(kind, page), ["seo-sitemap-page-v1", kind, String(page)], { revalidate: 60 })();
  return rows.length ? sitemapUrls(rows) : null;
}
