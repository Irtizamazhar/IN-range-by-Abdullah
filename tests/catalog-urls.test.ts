import { test } from "node:test";
import assert from "node:assert/strict";
import { slugBase, productPath, safeRedirectQuery } from "../lib/catalog-urls";
import { catalogFingerprint, planProductSlugs } from "../lib/product-slug-plan";
test("readable URL names and persisted slugs", () => {
  assert.equal(slugBase("Women's Fashion & Café"), "womens-fashion-cafe");
  assert.equal(productPath({ id: "internal", slug: "original-name" }), "/products/original-name");
  assert.equal(productPath({ id: "legacy" }), "/products/legacy");
});
test("backfill covers all products, avoids IDs and duplicates, preserves existing mappings", () => {
  const rows = [
    { id: "womens-fashion", name: "Existing", slug: "retained-title" },
    { id: "p2", name: "Women's Fashion", slug: null },
    { id: "p3", name: "Womens Fashion", slug: null },
    { id: "p4", name: "!!!", slug: null },
  ];
  const before = JSON.stringify(rows);
  const plan = planProductSlugs(rows);
  assert.deepEqual(plan, [{ id: "p2", slug: "womens-fashion-2" }, { id: "p3", slug: "womens-fashion-3" }, { id: "p4", slug: "product" }]);
  assert.equal(JSON.stringify(rows), before);
  const after = rows.map(row => ({ ...row, slug: plan.find(p => p.id === row.id)?.slug || row.slug }));
  assert.deepEqual(planProductSlugs(after), []);
  assert.notEqual(catalogFingerprint(rows), catalogFingerprint(after));
  assert.notEqual(catalogFingerprint(rows), catalogFingerprint(rows.map(row => ({ ...row, name: "Changed" }))));
});
test("backfill rejects invalid existing mappings instead of silently changing URLs", () => {
  assert.throws(() => planProductSlugs([{ id: "p1", name: "a", slug: "Invalid Slug" }]));
  assert.throws(() => planProductSlugs([{ id: "p1", name: "a", slug: "same" }, { id: "p2", name: "b", slug: "same" }]));
  assert.throws(() => planProductSlugs([{ id: "reserved", name: "a", slug: null }, { id: "p2", name: "b", slug: "reserved" }]));
});
test("redirects discard private and arbitrary query values", () => {
  assert.equal(safeRedirectQuery({ page: "2", token: "secret", email: "private@example.com", orderId: "private", sort: "price_asc" }), "?page=2&sort=price_asc");
  assert.equal(safeRedirectQuery({ variant: ["a", "b"], page: "//evil.com" }), "");
});
