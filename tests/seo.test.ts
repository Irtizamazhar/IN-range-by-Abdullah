import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { pageMetadata, productSchema, breadcrumbs, jsonLd, publicImageUrl, organizationSchema } from "../lib/seo";
import { shouldNoindex, ROBOTS_DISALLOW } from "../lib/seo-policy";
import { indexableProductWhere, indexableServiceWhere, indexableWantWhere, indexableStoreWhere } from "../lib/seo-data";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Read-only query and route fixtures.
type Modules = Record<string, any>;
function load(file: string, modules: Modules): Modules {
  const exports = {};
  runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: (name: string) => modules[name] ?? require(name), Response, Request, URL, URLSearchParams, Date, console, process });
  return exports;
}
const eligibility = { indexableProductWhere, indexableServiceWhere, indexableStoreWhere, indexableWantWhere };
function sitemapModule(db: Modules = {}) {
  return load("lib/seo-sitemap.ts", { "next/cache": { unstable_cache: (read: () => unknown) => read }, "@/lib/prisma": { prisma: db }, "@/lib/seo-data": eligibility });
}

test("public metadata uses HTTPS apex canonicals and correct sharing data without a global index override", () => {
  const m = pageMetadata("A product", "Actual product description", "/products/a", "/uploads/products/a.png");
  assert.equal(m.alternates?.canonical, "https://joro.pk/products/a");
  assert.equal(m.robots, undefined);
  assert.equal(m.openGraph?.url, "https://joro.pk/products/a");
  assert.equal(publicImageUrl("https://user:secret@example.test/a.png"), undefined);
  assert.equal(publicImageUrl("/api/order-payment-staging/private"), undefined);
  assert.equal(publicImageUrl("/api/image/public"), "https://joro.pk/api/image/public");
});

test("private/search/filter URLs are noindex; public pagination stays independently indexable", () => {
  for (const p of ["/account", "/vendor/dashboard", "/cart", "/checkout", "/login", "/search", "/invoice/a", "/marketing/preferences", "/myhome"]) assert.equal(shouldNoindex(p, new URLSearchParams()), true, p);
  assert.equal(shouldNoindex("/products", new URLSearchParams("category=Phones&sort=price_asc")), true);
  assert.equal(shouldNoindex("/wants", new URLSearchParams("tab=mine")), true);
  assert.equal(shouldNoindex("/products", new URLSearchParams("page=2")), false);
  assert.equal(shouldNoindex("/services/id", new URLSearchParams()), false);
  assert.equal(shouldNoindex("/api/image/public", new URLSearchParams()), false);
  assert.equal(ROBOTS_DISALLOW.includes("/api/"), true);
});

test("Product/Offer JSON-LD mirrors real PKR price and stock, escapes script injection and invents no reviews", () => {
  const schema = productSchema({ id: "a", name: "Phone </script><script>alert(1)</script>", description: "Actual details", category: "Phones", price: "1200.50", stock: 0, images: ["/uploads/products/a.png"] }, { name: "Real shop", path: "/stores/real" });
  assert.equal(schema.offers?.price, 1200.5); assert.equal(schema.offers?.priceCurrency, "PKR");
  assert.equal(schema.offers?.availability, "https://schema.org/OutOfStock");
  assert.equal("aggregateRating" in schema, false); assert.equal("shippingDetails" in schema.offers!, false);
  assert.ok(!jsonLd(schema).includes("</script>"));
  assert.equal(JSON.parse(jsonLd(schema)).name, schema.name);
  assert.equal(breadcrumbs([{ name: "Home", path: "/" }, { name: "Phones", path: "/categories/phones" }]).itemListElement[1].position, 2);
});

test("shared return policy uses Google's organization-level link option without inventing return terms", () => {
  const org = JSON.parse(jsonLd(organizationSchema()));
  assert.equal(org["@id"], "https://joro.pk/#organization");
  assert.deepEqual(org.hasMerchantReturnPolicy, { "@type": "MerchantReturnPolicy", merchantReturnLink: "https://joro.pk/return-policy" });
  for (const key of ["merchantReturnDays", "returnPolicyCategory", "refundType", "returnShippingFeesAmount"]) assert.equal(key in org.hasMerchantReturnPolicy, false);
  assert.equal("hasShippingService" in org, false, "city-only PK coverage must not become nationwide delivery");
  const product = productSchema({ id: "vendor-product", name: "Real name", description: "Real description", category: "Phones", price: 200, stock: 1, images: [] }, { name: "Seller shop", path: "/stores/seller" });
  assert.equal(product.offers?.seller?.name, "Seller shop");
  for (const key of ["brand", "gtin", "gtin13", "review", "aggregateRating"]) assert.equal(key in product, false);
  assert.equal("hasMerchantReturnPolicy" in product.offers!, false, "marketplace terms must not overwrite seller exceptions");
});

test("merchant shipping reads only persisted checkout fields; missing/invalid data never produces fallback charges", async () => {
  let row: Modules | null = { codCharges: "237.50", codAvailableCities: ["Karachi", "Lahore"] };
  let failed = false;
  const reads: Modules[] = [];
  const shipping = load("lib/merchant-shipping.ts", { "@/lib/prisma": { prisma: { settings: { findFirst: async (query: Modules) => { reads.push(query); if (failed) throw new Error("private driver diagnostics"); return row; } } } } });
  row = { codCharges: "237.50", codAvailableCities: ["Karachi", "Lahore", "Admin Town"] };
  const read = JSON.parse(JSON.stringify(await shipping.readMerchantShipping()));
  // The 95 built-in COD cities plus the admin's extra city, without duplicates.
  assert.equal(read.fee, 237.5); assert.equal(read.cities.length, 96);
  for (const city of ["Karachi", "Lahore", "Ahmadpur East", "Admin Town"]) assert.ok(read.cities.includes(city), city);
  row = { codCharges: 0, codAvailableCities: [] };
  assert.equal((await shipping.readMerchantShipping()).fee, 0);
  for (row of [null, { codCharges: null, codAvailableCities: [] }, { codCharges: -1, codAvailableCities: [] }, { codCharges: "invalid", codAvailableCities: [] }, { codCharges: 100, codAvailableCities: [null] }]) assert.equal(await shipping.readMerchantShipping(), null);
  failed = true; assert.equal(await shipping.readMerchantShipping(), null);
  for (const query of reads) assert.deepEqual(JSON.parse(JSON.stringify(query)), { select: { codCharges: true, codAvailableCities: true } });
});

test("sitemap index splits catalogs, escapes XML, uses real dates and excludes protected/draft/redirect URLs", () => {
  const s = sitemapModule();
  const index = s.sitemapIndex({ products: 5001, categories: 1, services: 1, stores: 1, wants: 1 });
  assert.match(index, /products-0.xml/); assert.match(index, /products-1.xml/); assert.doesNotMatch(index, /products-2.xml/);
  assert.ok(s.STATIC_SEO_PATHS.includes("/categories"));
  for (const p of ["/admin", "/vendor", "/account", "/login", "/sell", "/privacy-policy", "/terms-and-conditions", "/deals"]) assert.equal(s.STATIC_SEO_PATHS.includes(p), false, p);
  const xml = s.sitemapUrls([{ url: "https://joro.pk/products/a?x=1&y=2", updatedAt: "2026-10-01T00:00:00Z" }, { url: "https://joro.pk/" }]);
  assert.match(xml, /&amp;y=2/); assert.equal((xml.match(/<lastmod>/g) || []).length, 1);
  assert.doesNotMatch(xml, /changefreq|priority/);
  assert.throws(() => s.sitemapIndex({ products: Number.MAX_SAFE_INTEGER, categories: 0, services: 0, stores: 0, wants: 0 }));
});

test("sitemap queries share exact public eligibility and only select bounded row identifiers/timestamps", async () => {
  const calls: Modules[] = [];
  const model = (kind: string) => ({ count: async ({ where }: Modules) => { calls.push({ kind, where }); return 1; }, findMany: async (args: Modules) => { calls.push({ kind, ...args }); return [{ id: "public", slug: "real-category", storeSlug: "real-store", updatedAt: new Date("2026-10-01") }]; } });
  const s = sitemapModule({ product: model("product"), category: model("category"), serviceOffering: model("service"), vendor: model("store"), want: model("want") });
  await s.sitemapCounts();
  assert.equal(calls[0].where, indexableProductWhere); assert.equal(calls[2].where, indexableServiceWhere);
  assert.equal(calls[4].where.status, "OPEN"); assert.equal(calls[4].where.customer.isActive, true);
  for (const kind of ["products", "categories", "services", "stores", "wants"]) await s.sitemapRows(kind, 1);
  for (const call of calls.filter(c => c.take)) { assert.equal(call.take, 5000); assert.equal(call.skip, 5000); assert.equal(call.select.data, undefined); }
});

test("database failure is explicit 503; robots never discloses a private admin path; maintenance gates stay intact", async () => {
  const sitemap = load("app/sitemap.xml/route.ts", { "@/lib/seo-sitemap": { loadSitemapIndex: async () => { throw new Error("private DB connection details"); } }, "@/lib/private-launch/session": { isMaintenanceMode: () => false } });
  const failed = await sitemap.GET(); assert.equal(failed.status, 503); assert.equal(failed.headers.get("cache-control"), "no-store"); assert.doesNotMatch(await failed.text(), /connection/);
  const robots = load("app/robots.txt/route.ts", { "@/lib/private-launch/session": { isMaintenanceMode: () => false } });
  const response = await robots.GET(); const body = await response.text();
  assert.equal(response.status, 200); assert.match(body, /Sitemap: https:\/\/joro.pk\/sitemap.xml/); assert.match(body, /Allow: \/api\/image\//);
  assert.doesNotMatch(body, /ADMIN_SECRET|admin|fixture-control/);
  const maintenance = load("app/robots.txt/route.ts", { "@/lib/private-launch/session": { isMaintenanceMode: () => true } });
  assert.equal(await (await maintenance.GET()).text(), "User-agent: *\nDisallow: /\n");
});
