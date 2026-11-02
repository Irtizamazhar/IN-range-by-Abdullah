import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as nextServer from "next/server";
import { newArrivalsWindowStart } from "../lib/product-new-arrival-window";

const HOUR = 3_600_000;
const NOW = Date.now();
const ago = (hours: number) => new Date(NOW - hours * HOUR);

type Row = { id: string; name: string; description: string; category: string; isActive: boolean; stock: number; createdAt: Date; price: number };
const row = (id: string, extra: Partial<Row> = {}): Row =>
  ({ id, name: id, description: "", category: "Electronics", isActive: true, stock: 5, createdAt: ago(1), price: 100, ...extra });

/** Evaluates the subset of Prisma `where` the listing queries use. */
function matches(product: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return (condition as Record<string, unknown>[]).every((part) => matches(product, part));
    if (key === "OR") return (condition as Record<string, unknown>[]).some((part) => matches(product, part));
    if (key === "NOT") return !matches(product, condition as Record<string, unknown>);
    const value = product[key];
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      const c = condition as { in?: unknown[]; contains?: string; gt?: number; gte?: Date; lt?: Date };
      if (c.in && !c.in.includes(value)) return false;
      if (c.contains !== undefined && !String(value).toLowerCase().includes(c.contains.toLowerCase())) return false;
      if (c.gt !== undefined && !((value as number) > c.gt)) return false;
      if (c.gte !== undefined && !((value as Date) >= c.gte)) return false;
      if (c.lt !== undefined && !((value as Date) < c.lt)) return false;
      return true;
    }
    return value === condition;
  });
}

type OrderBy = Record<string, "asc" | "desc">;
function fakeDb(rows: Row[]) {
  const findMany = async (args: { where?: Record<string, unknown>; orderBy?: OrderBy | OrderBy[]; skip?: number; take?: number } = {}) => {
    let found = rows.filter((product) => matches(product, args.where));
    const order = args.orderBy ? (Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]) : [];
    found = [...found].sort((a, b) => {
      for (const part of order) {
        const [key, dir] = Object.entries(part)[0];
        const x = a[key as keyof Row], y = b[key as keyof Row];
        const cmp = x instanceof Date ? +x - +(y as Date) : x < y ? -1 : x > y ? 1 : 0;
        if (cmp) return dir === "desc" ? -cmp : cmp;
      }
      return 0;
    });
    const skip = args.skip ?? 0;
    return found.slice(skip, skip + (args.take ?? found.length));
  };
  const none = { findMany: async () => [] };
  return {
    product: { findMany, count: async (args: { where?: Record<string, unknown> }) => rows.filter((p) => matches(p, args.where)).length, aggregate: async () => ({ _min: { price: 0 }, _max: { price: 0 } }) },
    serviceOffering: none, category: none, want: none, vendor: none,
  };
}

const require = createRequire(import.meta.url);
function load(file: string, modules: Record<string, unknown>, jsx = false) {
  const exported: Record<string, unknown> = {};
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, ...(jsx ? { jsx: ts.JsxEmit.React } : {}) } }).outputText;
  runInNewContext(js, { exports: exported, React, require: (name: string) => (name in modules ? modules[name] : require(name)), console, Date, URL, Response, Request, Map, Set });
  return exported;
}
const serialize = { serializeProduct: (product: Row) => ({ ...product, _id: product.id, images: [] }) };
const common = {
  "@/lib/serialize": serialize,
  "@/lib/review-stats": { reviewStatsForProductIds: async () => new Map(), pickReviewStat: () => ({ reviewCount: 0, ratingAvg: 0 }) },
  "@/lib/catalog-product-select": { catalogProductSelect: () => undefined },
};
// Copy values out of the VM realm so deepStrictEqual compares plain arrays.
const ids = (list: { _id?: string; id?: string }[]) => Array.from(list, (item) => String(item._id ?? item.id));

function giftModule(rows: Row[]) {
  return load("lib/gift-products.ts", { ...common, "@/lib/prisma": { prisma: fakeDb(rows) } }) as {
    giftProducts: (f?: { search?: string; category?: string; take?: number }) => Promise<{ _id: string }[]>;
    GIFT_CATEGORY_NAMES: string[];
  };
}

test("Gifts depend only on the assigned category, never on the title", async () => {
  const gifts = giftModule([]);
  const GIFT = gifts.GIFT_CATEGORY_NAMES[0];
  const rows = [
    row("gift-watch-electronics", { name: "Gift Watch", category: "Electronics" }),
    row("birthday-candles-home", { name: "Birthday Wedding Anniversary Candles", description: "perfect gift", category: "Home & Living" }),
    row("beautiful-watch-gifts", { name: "Beautiful Watch", category: GIFT }),
    row("hamper-gifts-out-of-stock", { name: "Hamper", category: GIFT, stock: 0 }),
    row("gift-inactive", { name: "Mug", category: GIFT, isActive: false }),
  ];
  assert.deepEqual(ids(await giftModule(rows).giftProducts()), ["beautiful-watch-gifts"]);
  // Search stays within gift products.
  assert.deepEqual(ids(await giftModule(rows).giftProducts({ search: "watch" })), ["beautiful-watch-gifts"]);
  assert.deepEqual(ids(await giftModule(rows).giftProducts({ search: "candles" })), []);
  // A non-gift category filter cannot pull ordinary products into Gifts.
  assert.deepEqual(ids(await giftModule(rows).giftProducts({ category: "Electronics" })), []);
  assert.deepEqual(ids(await giftModule(rows).giftProducts({ category: GIFT })), ["beautiful-watch-gifts"]);
  // Moving a product into or out of the Gifts category updates eligibility.
  rows[0].category = GIFT;
  rows[2].category = "Watches & Jewellery";
  assert.deepEqual(ids(await giftModule(rows).giftProducts()), ["gift-watch-electronics"]);
  // Title-keyword matching is gone from the code path.
  assert.equal(readFileSync("lib/gift-products.ts", "utf8").includes("name: { contains: term }"), false);
});

test("site search groups gifts by category and keeps gift-titled products in Products", async () => {
  const GIFT = giftModule([]).GIFT_CATEGORY_NAMES[0];
  const rows = [row("gift-watch", { name: "Gift Watch", category: "Electronics" }), row("smart-watch-gift-cat", { name: "Smart Watch", category: GIFT })];
  const gifts = load("lib/gift-products.ts", { ...common, "@/lib/prisma": { prisma: fakeDb(rows) } });
  const search = load("lib/public-search.ts", { "@/lib/prisma": { prisma: fakeDb(rows) }, "@/lib/gift-products": gifts }) as {
    searchPublicMarketplace: (q: string) => Promise<{ id: string; kind: string }[]>;
  };
  const results = await search.searchPublicMarketplace("watch");
  assert.deepEqual(Array.from(results.filter((r) => r.kind === "products"), (r) => r.id), ["gift-watch"]);
  assert.deepEqual(Array.from(results.filter((r) => r.kind === "gifts"), (r) => r.id), ["smart-watch-gift-cat"]);
});

async function newArrivalIds(rows: Row[], legacy: { id: number; name: string; category: string }[]) {
  const catalog = load("lib/new-arrivals-catalog.ts", {
    ...common,
    "@/lib/prisma": { prisma: fakeDb(rows) },
    "@/lib/products-store": { readProducts: async () => legacy.map((p) => ({ ...p, price: 100, image: "/x.png", images: ["/x.png"], isNew: true, stock: 5, inStock: true, isFeatured: false, createdAt: "2026-01-01" })) },
  }) as { loadMergedNewArrivalCards: (o: { search: string; category: string }) => Promise<{ _id: string; href?: string }[]> };
  return Array.from(await catalog.loadMergedNewArrivalCards({ search: "", category: "" }), (card) => ({ id: card._id, href: card.href }));
}

async function allProductIds(rows: Row[], query = "") {
  const route = load("app/api/products/route.ts", {
    ...common, "next/server": nextServer, "@/lib/prisma": { prisma: fakeDb(rows) },
    "@/lib/sessions": { getAdminSession: async () => null },
    "@/lib/admin-rbac": { requireAdminPermission: async () => ({ response: new Response(null, { status: 401 }) }) },
    "@/lib/product-discount": { computeDiscountPercent: () => null },
  }) as { GET: (req: nextServer.NextRequest) => Promise<Response> };
  const body = (await (await route.GET(new nextServer.NextRequest(`http://localhost/api/products${query}`))).json()) as { products: { _id: string; createdAt?: string }[]; total: number; totalPages: number };
  return body;
}

test("an admin New Arrival is one product in both New Arrivals and All Products", async () => {
  const rows = [row("na-1", { name: "Admin Arrival", createdAt: ago(2) }), row("vendor-new", { createdAt: ago(5) }), row("old", { createdAt: ago(20 * 24) })];
  const arrivals = await newArrivalIds(rows, [{ id: 1, name: "Admin Arrival", category: "Electronics" }]);
  assert.deepEqual(arrivals.map((a) => a.id), ["na-1", "vendor-new"]);
  assert.equal(arrivals[0].href, "/new-arrivals/1");
  const all = await allProductIds(rows);
  assert.deepEqual(ids(all.products), ["na-1", "vendor-new", "old"]);
  assert.ok(all.products.every((p) => p.createdAt), "createdAt reaches the card for the NEW badge");
});

test("after 14 days a New Arrival leaves New Arrivals but stays in All Products", async () => {
  const expired = row("na-2", { createdAt: new Date(newArrivalsWindowStart(new Date(NOW)).getTime() - HOUR) });
  assert.deepEqual(await newArrivalIds([expired], [{ id: 2, name: "na-2", category: "Electronics" }]), []);
  assert.deepEqual(ids((await allProductIds([expired])).products), ["na-2"]);
  // Inactive products stay hidden from both.
  const hidden = row("na-3", { isActive: false });
  assert.deepEqual(await newArrivalIds([hidden], [{ id: 3, name: "na-3", category: "Electronics" }]), []);
  assert.deepEqual(ids((await allProductIds([hidden])).products), []);
});

test("All Products pagination never repeats or skips products with equal timestamps", async () => {
  const sameDay = new Date("2026-11-01T00:00:00.000Z");
  const rows = Array.from({ length: 25 }, (_, index) => row(`na-${String(index).padStart(2, "0")}`, { createdAt: sameDay }));
  const seen: string[] = [];
  for (let page = 1; page <= 3; page++) seen.push(...ids((await allProductIds(rows, `?page=${page}&limit=10`)).products));
  assert.equal(seen.length, 25);
  assert.equal(new Set(seen).size, 25);
  // Search and category filters still apply.
  const mixed = [row("watch", { name: "Smart Watch", category: "Watches" }), row("cable", { name: "Cable", category: "Mobile" })];
  assert.deepEqual(ids((await allProductIds(mixed, "?search=watch")).products), ["watch"]);
  assert.deepEqual(ids((await allProductIds(mixed, "?category=Mobile")).products), ["cable"]);
});

test("ProductCard shows a small NEW badge only within 14 days, alongside the discount badge", () => {
  const stub = ({ children, ...props }: { children?: React.ReactNode; href?: string; className?: string }) => React.createElement(props.href ? "a" : "button", props, children);
  const card = load("components/user/ProductCard.tsx", {
    "@/components/ui/LoadingButton": { LoadingButton: stub },
    "@/components/ui/LoadingLink": { default: stub },
    "next/image": { default: () => null },
    "lucide-react": new Proxy({}, { get: () => () => null }),
    "@/context/CartContext": { useCart: () => ({ items: [], addItem: () => undefined }) },
    "@/lib/use-saved-products": { useSavedProducts: () => ({ ids: [], toggle: () => undefined, saving: false, loading: false }) },
    "@/lib/cart-success-toast": { showCartSuccessToast: () => undefined },
    // CSS module default export: each class name maps to itself.
    "./ProductCard.module.css": { default: new Proxy({}, { get: (_t, key) => String(key) }) },
  }, true) as { ProductCard: React.ComponentType<Record<string, unknown>> };
  const render = (createdAt: Date | undefined, showNewTag = true) => renderToStaticMarkup(React.createElement(card.ProductCard, {
    showNewTag, product: { _id: "p1", name: "P", price: 80, originalPrice: 100, images: [], category: "C", stock: 3, createdAt },
  }));
  const fresh = render(ago(24));
  assert.match(fresh, /class="newBadge">NEW</);
  assert.match(fresh, /class="badge">-20%</, "discount badge is kept");
  assert.match(fresh, /href="\/products\/p1"/, "detail link intact");
  assert.doesNotMatch(render(ago(15 * 24)), /NEW</);
  assert.doesNotMatch(render(ago(24), false), /NEW</, "other listings opt in explicitly");
  assert.doesNotMatch(render(undefined), /NEW</);
});
