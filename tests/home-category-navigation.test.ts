import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { runInNewContext } from "node:vm";

function readers(tenCategories = false) {
  const fixture: { prisma?: { category: { findMany: (args: unknown) => Promise<unknown[]>; findFirst: (args: unknown) => Promise<unknown> } } } = {};
  runInNewContext(fs.readFileSync("scripts/fixtures/seo-prisma.cjs", "utf8"), { globalThis: fixture, process: { env: { JORO_FIXTURE_TEN_CATEGORIES: String(tenCategories) }, on() {} } });
  const queries: { operation: string; args: { where: Record<string, unknown>; orderBy?: unknown } }[] = [];
  const db = { category: {
    findMany: async (args: { where: Record<string, unknown> }) => { queries.push({ operation: "findMany", args }); return fixture.prisma!.category.findMany(args); },
    findFirst: async (args: { where: Record<string, unknown> }) => { queries.push({ operation: "findFirst", args }); return fixture.prisma!.category.findFirst(args); },
  } };
  const exports: Record<string, unknown> = {};
  runInNewContext(ts.transpileModule(fs.readFileSync("lib/seo-data.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (name: string) => {
      if (name === "@/lib/prisma") return { prisma: db };
      if (name === "@/lib/seo-cache") return { requestCache: (read: unknown) => read };
      if (name === "@/lib/catalog-product-select") return { catalogProductSelect: () => ({}) };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { queries, home: exports.seoHomepageCategories as () => Promise<{ slug: string; image: string }[]>,
    category: exports.seoCategory as (slug: string) => Promise<{ slug: string } | null> };
}

test("homepage includes only eligible populated categories, preserving configured order and images", async () => {
  const { home, queries } = readers();
  const rows = await home();
  assert.deepEqual(Array.from(rows, row => row.slug), ["phones", ...Array.from({ length: 6 }, (_, i) => `public-category-${i}`), "hidden-category"]);
  assert.ok(rows.every(row => row.image === "/icon.png"));
  assert.equal(queries.length, 1);
  assert.equal(queries[0].args.where.showOnHome, undefined);
  assert.equal((queries[0].args as { take?: number }).take, 10);
  assert.equal(JSON.stringify(queries[0].args.orderBy), JSON.stringify([{ showOnHome: "desc" }, { sortOrder: "asc" }, { name: "asc" }]));
  assert.equal(queries[0].args.where.isActive, true);
  assert.ok(queries[0].args.orderBy);
});

test("every homepage link resolves through the same public category guard", async () => {
  const { home, category, queries } = readers();
  for (const row of await home()) {
    const result = await category(row.slug);
    assert.equal(result?.slug, row.slug);
  }
  const homeProducts = queries[0].args.where.products;
  for (const query of queries.slice(1)) assert.deepEqual(query.args.where.products, homeProducts);
});

test("empty, inactive, pending-vendor, suspended-vendor and private-only categories are excluded and unavailable", async () => {
  const { home, category } = readers();
  const advertised = new Set(Array.from(await home(), row => row.slug));
  for (const slug of ["empty-category", "inactive-category", "inactive-product-category", "pending-category", "suspended-category", "private-category", "missing-category"]) {
    assert.equal(advertised.has(slug), false, slug);
    assert.equal(await category(slug), null, slug);
  }
});

test("eligible non-homepage categories supplement preferred categories without changing their settings", async () => {
  const { home, category } = readers();
  assert.equal((await home()).at(-1)?.slug, "hidden-category");
  assert.equal((await category("hidden-category"))?.slug, "hidden-category");
});

test("ten preferred eligible categories fill the row before supplementary categories", async () => {
  const { home, category } = readers(true);
  const rows = await home();
  assert.equal(rows.length, 10);
  assert.equal(new Set(rows.map(row => row.slug)).size, 10);
  assert.equal(rows.some(row => row.slug === "hidden-category"), false);
  for (const row of rows) assert.equal((await category(row.slug))?.slug, row.slug);
});

test("out-of-stock public products remain eligible under the existing public-product policy", async () => {
  const { home, category } = readers();
  assert.ok((await home()).some(row => row.slug === "public-category-0"));
  assert.equal((await category("public-category-0"))?.slug, "public-category-0");
});
