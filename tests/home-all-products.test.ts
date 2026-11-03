import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import React from "react";
import * as nextServer from "next/server";
import { HOME_ALL_PRODUCTS_LIMIT, homeAllProductRows, homeAllProductsWhere } from "../lib/home-all-products";
import { NEW_ARRIVAL_WINDOW_DAYS, isProductInNewArrivalsWindow, newArrivalsProgress, newArrivalsWindowEnd, newArrivalsWindowStart } from "../lib/product-new-arrival-window";
import { syncVendorProductStorefront } from "../lib/sync-vendor-product-storefront";
import type { ProductCardData } from "../components/user/ProductCard";

const HOUR = 3_600_000;
const NOW = new Date("2026-11-01T12:00:00.000Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

type Row = { id: string; isActive: boolean; isBestSeller: boolean; createdAt: Date };
const row = (id: string, hoursAgo: number, extra: Partial<Row> = {}): Row =>
  ({ id, isActive: true, isBestSeller: false, createdAt: ago(hoursAgo), ...extra });

/** Minimal in-memory product table that honours the where/orderBy/take the catalog queries use. */
function fakeDb(rows: Row[]) {
  const calls: { where: Record<string, unknown> }[] = [];
  const matches = (product: Row, where: Record<string, unknown>) => Object.entries(where).every(([key, condition]) => {
    const value = product[key as keyof Row];
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      const c = condition as { lt?: Date; gte?: Date; gt?: number };
      if (c.lt !== undefined && !(value < c.lt)) return false;
      if (c.gte !== undefined && !(value >= c.gte)) return false;
      if (c.gt !== undefined && !((value as unknown as number) > c.gt)) return false;
      return true;
    }
    return value === condition;
  });
  const findMany = async (args: { where?: Record<string, unknown>; orderBy?: { createdAt?: "asc" | "desc" }; take?: number; skip?: number } = {}) => {
    calls.push({ where: args.where ?? {} });
    let found = rows.filter((product) => matches(product, args.where ?? {}));
    if (args.orderBy?.createdAt === "desc") found = [...found].sort((a, b) => +b.createdAt - +a.createdAt);
    return found.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? found.length));
  };
  return { calls, product: { findMany, count: async (args: { where?: Record<string, unknown> }) => (await findMany(args)).length, aggregate: async () => ({ _min: { price: 0 }, _max: { price: 0 } }) } };
}

const allProducts = async (rows: Row[]) =>
  (await homeAllProductRows(fakeDb(rows) as unknown as Parameters<typeof homeAllProductRows>[0])).map((product) => product.id);

const require = createRequire(import.meta.url);
function load(file: string, modules: Record<string, unknown>) {
  const exported: Record<string, unknown> = {};
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { exports: exported, require: (name: string) => (name in modules ? modules[name] : require(name)), console, Date, URL, Response, Request });
  return exported;
}
const passThrough = {
  "@/lib/serialize": { serializeProduct: (product: Row) => ({ ...product, _id: product.id }) },
  "@/lib/review-stats": { reviewStatsForProductIds: async () => new Map(), pickReviewStat: () => ({ reviewCount: 0, ratingAvg: 0 }) },
  "@/lib/catalog-product-select": { catalogProductSelect: () => undefined },
};

async function newArrivalIds(rows: Row[]) {
  const catalog = load("lib/new-arrivals-catalog.ts", {
    ...passThrough,
    "@/lib/prisma": { prisma: fakeDb(rows) },
    "@/lib/products-store": { readProducts: async () => [] },
    "@/lib/new-arrival-product-card": { sortedNewArrivalRows: (r: unknown[]) => r, storedProductToNewArrivalCard: () => ({}) },
    "@/lib/product-new-arrival-window": { newArrivalsWindowStart: () => newArrivalsWindowStart(NOW) },
  }) as { loadMergedNewArrivalCards: (o: { search: string; category: string }) => Promise<{ _id: string }[]> };
  // Copy out of the VM realm so deepStrictEqual compares plain arrays.
  return Array.from(await catalog.loadMergedNewArrivalCards({ search: "", category: "" }), (card) => card._id);
}

test("New Arrivals keeps products for 14 full days (unchanged)", async () => {
  assert.equal(NEW_ARRIVAL_WINDOW_DAYS, 14);
  assert.equal(isProductInNewArrivalsWindow(ago(24), NOW), true);
  assert.equal(isProductInNewArrivalsWindow(ago(13 * 24), NOW), true);
  assert.equal(isProductInNewArrivalsWindow(ago(336), NOW), true);
  assert.equal(isProductInNewArrivalsWindow(new Date(ago(336).getTime() - 1), NOW), false);
  const ids = await newArrivalIds([row("one-day", 24), row("thirteen-days", 13 * 24), row("fifteen-days", 15 * 24), row("inactive", 2, { isActive: false })]);
  assert.deepEqual(ids, ["one-day", "thirteen-days"]);
});

test("vendor countdown through New Arrivals moves hour by hour", () => {
  const at = (hoursAgo: number) => newArrivalsProgress(ago(hoursAgo), NOW);
  assert.deepEqual(at(0), { ended: false, daysLeft: 14, hoursLeft: 0, elapsedPct: 0 });
  // The screenshot case: about 22 hours after publishing it no longer says "14 days, 0%".
  assert.deepEqual(at(22), { ended: false, daysLeft: 13, hoursLeft: 2, elapsedPct: 6 });
  assert.deepEqual(at(24), { ended: false, daysLeft: 13, hoursLeft: 0, elapsedPct: 7 });
  assert.deepEqual(at(168), { ended: false, daysLeft: 7, hoursLeft: 0, elapsedPct: 50 });
  assert.deepEqual(at(335.5), { ended: false, daysLeft: 0, hoursLeft: 1, elapsedPct: 99 });
  assert.equal(at(336).ended, false);
  assert.deepEqual(newArrivalsProgress(new Date(ago(336).getTime() - 1), NOW), { ended: true, daysLeft: 0, hoursLeft: 0, elapsedPct: 100 });
  assert.equal(newArrivalsWindowEnd(ago(0)).getTime(), NOW.getTime() + 336 * HOUR);
  // The countdown ends exactly when the product leaves New Arrivals.
  for (const hours of [335, 336, 336.001, 400]) {
    assert.equal(at(hours).ended, !isProductInNewArrivalsWindow(ago(hours), NOW), String(hours));
  }
});

test("All Products shows new products right away, alongside older ones", async () => {
  const nineUploadedToday = Array.from({ length: 9 }, (_, index) => row(`today-${index}`, index + 1));
  assert.deepEqual(await allProducts(nineUploadedToday), nineUploadedToday.map((product) => product.id));
  assert.deepEqual(await allProducts([row("old", 20 * 24), row("one-day", 24), row("thirteen-days", 13 * 24)]), ["one-day", "thirteen-days", "old"]);
  assert.equal(JSON.stringify(homeAllProductsWhere).includes("createdAt"), false);
});

test("Best Seller status has no influence on All Products", async () => {
  const ids = await allProducts([row("old-plain", 20 * 24), row("older-best-seller", 30 * 24, { isBestSeller: true }), row("new-plain", 2)]);
  assert.deepEqual(ids, ["new-plain", "old-plain", "older-best-seller"]);
  assert.equal(JSON.stringify(homeAllProductsWhere).includes("isBestSeller"), false);
});

test("All Products is newest first, active only, and capped at 12", async () => {
  assert.equal(HOME_ALL_PRODUCTS_LIMIT, 12);
  const products = Array.from({ length: 15 }, (_, index) => row(`p-${index}`, index * 30));
  const ids = await allProducts([...products].reverse().concat(row("inactive-new", 0.5, { isActive: false })));
  assert.deepEqual(ids, products.slice(0, 12).map((product) => product.id));
});

test("the New tag lasts exactly the 14-day New Arrivals period", () => {
  // HomeProductCard shows "New" while isProductInNewArrivalsWindow is true, the same rule New Arrivals uses.
  const card = readFileSync("components/user/HomeProductCard.tsx", "utf8");
  assert.ok(card.includes("const isNew = showNewTag && !!product.createdAt && isProductInNewArrivalsWindow(new Date(product.createdAt));"));
  assert.equal(isProductInNewArrivalsWindow(ago(1), NOW), true);
  assert.equal(isProductInNewArrivalsWindow(ago(13 * 24), NOW), true);
  assert.equal(isProductInNewArrivalsWindow(ago(336), NOW), true);
  assert.equal(isProductInNewArrivalsWindow(new Date(ago(336).getTime() - 1), NOW), false);
  assert.equal(isProductInNewArrivalsWindow(ago(20 * 24), NOW), false);
});

test("homepage All Products is hidden when empty and shows up to 12 cards with the New tag enabled", () => {
  const HomeProductCard = () => null;
  const exported: Record<string, unknown> = {};
  const js = ts.transpileModule(readFileSync("components/user/HomeMarketplace.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const stub = () => null;
  const modules: Record<string, unknown> = {
    "@/components/ui/LoadingLink": { default: stub }, "next/image": { default: stub }, "lucide-react": new Proxy({}, { get: () => stub }),
    "./ProductCard": { ProductCard: stub }, "./services/ServiceCard": { ServiceCard: stub }, "./TrendingWantCard": { TrendingWantCard: stub },
    "./HomeProductCard": { HOME_PRODUCT_GRID: "grid", HOME_VIEW_BUTTON: "button", HomeProductCard },
  };
  runInNewContext(js, { exports: exported, React, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
  const HomeAllProducts = exported.HomeAllProducts as (props: { products: ProductCardData[] }) => unknown;

  assert.equal(HomeAllProducts({ products: [] }), null);
  const products = Array.from({ length: 12 }, (_, index) => ({ _id: `p${index}`, name: `P${index}`, price: 1, images: [], category: "C" })) as unknown as ProductCardData[];
  const cards: unknown[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const element = node as { type?: unknown; props?: { children?: unknown } };
    if (element.type === HomeProductCard) cards.push(element);
    walk(element.props?.children);
  };
  walk(HomeAllProducts({ products }));
  assert.equal(cards.length, 12);
  assert.ok(cards.every((card) => (card as { props: { showNewTag?: boolean } }).props.showNewTag === true));
});

test("/products keeps listing newly uploaded products", async () => {
  const db = fakeDb([row("uploaded-today", 1), row("old", 20 * 24)]);
  const route = load("app/api/products/route.ts", {
    ...passThrough,
    "next/server": nextServer,
    "@/lib/prisma": { prisma: db },
    "@/lib/sessions": { getAdminSession: async () => null },
    "@/lib/admin-rbac": { requireAdminPermission: async () => ({ response: new Response(null, { status: 401 }) }) },
    "@/lib/product-discount": { computeDiscountPercent: () => null },
  }) as { GET: (req: nextServer.NextRequest) => Promise<Response> };
  const res = await route.GET(new nextServer.NextRequest("http://localhost/api/products"));
  const body = (await res.json()) as { products: { _id: string }[]; total: number };
  assert.deepEqual(body.products.map((product) => product._id), ["uploaded-today", "old"]);
  assert.equal(body.total, 2);
  assert.ok(db.calls.every((call) => !("createdAt" in call.where)));
});

test("editing a published vendor product does not reset its publication date", async () => {
  const writes: { op: string; data: Record<string, unknown> }[] = [];
  const vendorProduct = { id: "vp", status: "active", images: "[]", category: "C", price: 100, originalPrice: null, productName: "P", description: "d", stock: 1, warrantyMonths: null, publishedProductId: null as string | null };
  const db = {
    vendorProduct: { findUnique: async () => vendorProduct, update: async () => undefined },
    category: { findUnique: async () => null },
    product: {
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ op: "create", data }); return { id: "product-1" }; },
      update: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ op: "update", data }); return {}; },
    },
  } as unknown as Parameters<typeof syncVendorProductStorefront>[1];
  await syncVendorProductStorefront("vp", db);
  assert.equal(writes[0].op, "create");
  assert.ok(writes[0].data.createdAt instanceof Date, "first publication sets createdAt");
  vendorProduct.publishedProductId = "product-1";
  vendorProduct.price = 120;
  await syncVendorProductStorefront("vp", db);
  assert.equal(writes[1].op, "update");
  assert.equal("createdAt" in writes[1].data, false);
});
