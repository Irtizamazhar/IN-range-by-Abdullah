import test from "node:test";
import assert from "node:assert/strict";
import { catalogQueryKey, createPriceDebouncer, normalizePriceDraft, readCatalogFilters, updateCatalogQuery } from "../app/(user)/products/catalog-filter-state";

test("typing waits 500ms after the last edit and preserves intervening sort and stock choices", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let query = "search=organizer&category=Home&page=3";
  let commits = 0;
  const input = createPriceDebouncer((draft) => {
    commits += 1;
    query = updateCatalogQuery(query, normalizePriceDraft(draft, 50000)).toString();
  });
  input.schedule({ minimum: "100", maximum: "5000" });
  context.mock.timers.tick(400);
  assert.equal(commits, 0);
  query = updateCatalogQuery(query, { sort: "price_asc" }).toString();
  input.schedule({ minimum: "1200", maximum: "5000" });
  query = updateCatalogQuery(query, { inStock: true }).toString();
  context.mock.timers.tick(499);
  assert.equal(commits, 0);
  context.mock.timers.tick(1);
  assert.equal(commits, 1);
  const params = new URLSearchParams(query);
  assert.deepEqual(readCatalogFilters(params), { category: "Home", sort: "price_asc", minPrice: 1200, maxPrice: 5000, inStock: true });
  assert.equal(params.get("search"), "organizer");
  assert.equal(params.has("page"), false);
});

test("clearing filters or starting a slider drag cancels pending typed prices", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let commits = 0;
  const input = createPriceDebouncer(() => { commits += 1; });
  input.schedule({ minimum: "250", maximum: "1000" });
  context.mock.timers.tick(300);
  input.cancel();
  context.mock.timers.tick(1000);
  assert.equal(commits, 0);
});

test("shared filters round trip, clear to defaults, and retain the search", () => {
  const params = updateCatalogQuery("search=shoes", { category: "Fashion", minPrice: 0, maxPrice: 2500, sort: "price_desc", inStock: true });
  assert.deepEqual(readCatalogFilters(new URLSearchParams(params.toString())), { category: "Fashion", minPrice: 0, maxPrice: 2500, sort: "price_desc", inStock: true });
  const cleared = updateCatalogQuery(params.toString(), { category: "", minPrice: null, maxPrice: null, sort: "newest", inStock: false });
  assert.equal(cleared.toString(), "search=shoes");
  assert.equal(catalogQueryKey(new URLSearchParams("sort=newest&maxPrice=invalid")), catalogQueryKey(new URLSearchParams()));
});

test("price drafts handle zero, empty bounds, decimals and crossed slider bounds", () => {
  assert.deepEqual(normalizePriceDraft({ minimum: "", maximum: "" }, 50000), { minPrice: null, maxPrice: null });
  assert.deepEqual(normalizePriceDraft({ minimum: "0", maximum: "0" }, 50000), { minPrice: null, maxPrice: 0 });
  assert.deepEqual(normalizePriceDraft({ minimum: "123.50", maximum: "200.75" }, 50000), { minPrice: 123.5, maxPrice: 200.75 });
  assert.deepEqual(normalizePriceDraft({ minimum: "1000", maximum: "500" }, 50000), { minPrice: 1000, maxPrice: 1000 });
  assert.deepEqual(normalizePriceDraft({ minimum: "-10", maximum: "Infinity" }, 50000), { minPrice: null, maxPrice: null });
});
