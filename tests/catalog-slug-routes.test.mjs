import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, modules = {}) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(js, { exports, require: name => name in modules ? modules[name] : require(name), console, Date, URL, URLSearchParams, Response, Request, process });
  return exports;
}
const urls = load('lib/catalog-urls.ts');
const seo = load('lib/seo.ts', { '@/lib/catalog-urls': urls });
const product = { id: 'legacy-123', slug: 'wireless-headphones', name: 'Wireless Headphones', category: 'Audio', description: 'Test listing', isActive: true, images: [], price: 1500, stock: 2, categoryRecordId: 'cat-id' };
const category = { id: 'cat-id', name: 'Audio', slug: 'audio', image: '' };
function stop(status, location) { throw Object.assign(new Error(String(status)), { status, location }); }
const navigation = { notFound: () => stop(404), permanentRedirect: location => stop(308, location) };
const select = { catalogProductSelect: () => ({ id: true, slug: true }) };
function productPage(item = product, publication = null) {
  return load('app/(user)/products/[id]/page.tsx', {
    '@/lib/catalog-urls': urls, '@/lib/seo': seo,
    '@/lib/seo-data': { seoProduct: async () => item, indexableProductWhere: {} },
    '@/components/seo/JsonLd': { JsonLd: () => null }, 'next/navigation': navigation,
    '@/lib/catalog-product-select': select,
    '@/lib/prisma': { prisma: { product: { findFirst: async () => item, findMany: async () => [] }, vendorProduct: { findUnique: async () => publication }, category: { findFirst: async () => category } } },
    '@/lib/serialize': { serializeProduct: p => ({ ...p, _id: p.id, images: [] }) },
    '@/lib/settings-db': { readPublicSettings: async () => ({}) },
    './ProductDetailClient': { ProductDetailClient: () => null },
    '@/lib/review-stats': { reviewStatsForProductIds: async () => new Map(), pickReviewStat: () => ({}), getProductReviewDashboard: async () => ({ averageRating: 0, totalCount: 0 }) },
  });
}
test('actual product page: ID redirects once; slug renders; missing/unpublished records 404', async () => {
  const page = productPage();
  await assert.rejects(page.default({ params: { id: product.id }, searchParams: { variant: 'Black', token: 'private', orderId: 'private' } }), e => e.status === 308 && e.location === '/products/wireless-headphones?variant=Black');
  assert.ok(await page.default({ params: { id: product.slug } }));
  await assert.rejects(productPage(null).default({ params: { id: 'missing' } }), e => e.status === 404);
  await assert.rejects(productPage({ ...product, isActive: false }).default({ params: { id: product.id } }), e => e.status === 404);
  await assert.rejects(productPage(product, { status: 'pending', vendor: { status: 'approved' } }).default({ params: { id: product.id } }), e => e.status === 404);
  assert.ok(await productPage({ ...product, slug: null }).default({ params: { id: product.id } }));
});
test('canonical, Open Graph and Product/Offer JSON-LD agree on persisted slug', async () => {
  const metadata = await productPage().generateMetadata({ params: { id: product.slug } });
  assert.equal(metadata.alternates.canonical, 'https://joro.pk/products/wireless-headphones');
  assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
  const schema = seo.productSchema(product);
  assert.equal(schema.url, metadata.alternates.canonical);
  assert.equal(schema.offers.url, schema.url);
  assert.equal(seo.breadcrumbs([{ name: product.name, path: urls.productPath(product) }]).itemListElement[0].item, schema.url);
});
test('actual category routes: legacy ID redirects, canonical renders and metadata agrees', async () => {
  const modules = {
    '@/lib/catalog-urls': urls, 'next/navigation': navigation, '@/lib/seo': seo,
    '@/components/ui/LoadingLink': { default: () => null }, '@/components/user/ProductCard': { ProductCard: () => null }, '@/components/seo/JsonLd': { JsonLd: () => null },
    '@/lib/seo-data': { seoCategory: async slug => slug === 'missing' ? null : category },
    '@/lib/seo-catalog': { readSeoCatalog: async () => ({ products: [], total: 1, page: 1, totalPages: 1 }) },
  };
  const page = load('app/(user)/categories/[slug]/page.tsx', modules);
  await assert.rejects(page.default({ params: { slug: category.id }, searchParams: { page: '2' } }), e => e.status === 308 && e.location === '/categories/audio?page=2');
  assert.ok(await page.default({ params: { slug: category.slug } }));
  assert.equal((await page.generateMetadata({ params: { slug: category.slug } })).alternates.canonical, 'https://joro.pk/categories/audio');
  await assert.rejects(page.default({ params: { slug: 'missing' } }), e => e.status === 404);
  const alias = load('app/(user)/category/[slug]/page.tsx', modules);
  await assert.rejects(alias.default({ params: { slug: category.id } }), e => e.status === 308 && e.location === '/categories/audio');
});
test('actual legacy new-arrival route redirects directly to canonical slug', async () => {
  const page = load('app/(user)/new-arrivals/[id]/page.tsx', {
    '@/lib/catalog-urls': urls, '@/lib/seo-cache': { requestCache: fn => fn }, 'next/navigation': navigation,
    '@/lib/prisma': { prisma: { product: { findFirst: async () => product } } }, '@/lib/seo-data': { indexableProductWhere: {} },
    '@/lib/seo': seo, '@/lib/catalog-product-select': select, '@/lib/serialize': { serializeProduct: () => ({ images: [] }) },
  });
  await assert.rejects(page.default({ params: { id: '12' } }), e => e.status === 308 && e.location === '/products/wireless-headphones');
});
test('sitemap entries contain canonical slugs and sitemap/robots handlers remain crawlable', async () => {
  const predicates = { indexableProductWhere: {}, indexableServiceWhere: {}, indexableStoreWhere: {}, indexableWantWhere: () => ({}) };
  const sitemap = load('lib/seo-sitemap.ts', {
    '@/lib/catalog-urls': urls, '@/lib/seo': seo, '@/lib/seo-data': predicates,
    'next/cache': { unstable_cache: fn => fn },
    '@/lib/prisma': { prisma: { product: { findMany: async () => [product], count: async () => 1 }, category: { findMany: async () => [category], count: async () => 1 }, serviceOffering: { count: async () => 0 }, vendor: { count: async () => 0 }, want: { count: async () => 0 } } },
  });
  const products = await sitemap.loadSitemapPage('products', 0);
  assert.match(products, /https:\/\/joro.pk\/products\/wireless-headphones/);
  assert.doesNotMatch(products, /legacy-123/);
  assert.match(await sitemap.loadSitemapPage('categories', 0), /https:\/\/joro.pk\/categories\/audio/);
  const maintenance = { isMaintenanceMode: () => false };
  const index = load('app/sitemap.xml/route.ts', { '@/lib/seo-sitemap': sitemap, '@/lib/private-launch/session': maintenance });
  const response = await index.GET();
  assert.equal(response.status, 200);
  assert.match(await response.text(), /sitemaps\/products-0.xml/);
  const policy = load('lib/seo-policy.ts');
  const robots = load('app/robots.txt/route.ts', { '@/lib/seo': seo, '@/lib/seo-policy': policy, '@/lib/private-launch/session': maintenance });
  const robotsResponse = await robots.GET();
  assert.equal(robotsResponse.status, 200);
  const body = await robotsResponse.text();
  assert.match(body, /Sitemap: https:\/\/joro.pk\/sitemap.xml/);
  assert.doesNotMatch(body, /Disallow: \/(?:products|categories)\n/);
});
test('public link lookup is bounded and returns only paths for public product IDs', async () => {
  let captured;
  const eligible = { isActive: true, vendorPublication: { is: null } };
  const nextServer = require('next/server');
  const route = load('app/api/product-links/route.ts', {
    'next/server': nextServer, '@/lib/catalog-urls': urls,
    '@/lib/seo-data': { indexableProductWhere: eligible },
    '@/lib/prisma': { prisma: { product: { findMany: async args => { captured = args; return [product]; } } } },
  });
  const response = await route.GET(new nextServer.NextRequest('http://localhost/api/product-links?id=legacy-123'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { 'legacy-123': '/products/wireless-headphones' });
  assert.equal(captured.where.AND[0], eligible);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await route.GET(new nextServer.NextRequest('http://localhost/api/product-links?id=bad%2Fpath'))).status, 400);
  assert.equal((await route.GET(new nextServer.NextRequest('http://localhost/api/product-links?' + Array.from({ length: 101 }, (_, i) => 'id=p' + i).join('&')))).status, 400);
});
