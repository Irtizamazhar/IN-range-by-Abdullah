import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import * as marketplace from "../lib/marketplace-api";
import * as management from "../lib/service-management";
import * as locations from "../lib/service-locations";
import { coverageSchema, coversLocation, supportsCityOnlyCheckout, coverageLabel } from "../lib/service-coverage";
import { resolveServiceAddon } from "../lib/service-checkout-service";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Isolated Prisma and HTTP adapters, never real database writes.
type Row = Record<string, any>;
const require = createRequire(import.meta.url);
function load(file: string, modules: Row): Row {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (name: string) => modules[name] ?? require(name), Request, Response, URL, Date, Buffer, console });
  return exports;
}
function places() {
  process.env.SERVICE_LOCATION_SECRET = "isolated-service-location-test-secret";
  const proof = (id: string, parent?: string) => ({ version: 2 as const, providerId: "provider-" + id, sourceId: id, center: [74.3, 31.5] as [number, number], boundaryIds: ["osm:r:600"], cityNames: parent ? [] : ["fixture city"], ...(parent ? { citySourceId: parent } : {}), method: "source-hierarchy" as const });
  const city = locations.signPlace({ id: "osm:n:1001", name: "Fixture city", label: "Fixture city, Pakistan", kind: "city", proof: proof("osm:n:1001") }, null);
  const other = locations.signPlace({ id: "osm:n:1002", name: "Other fixture city", label: "Other city, Pakistan", kind: "city", proof: proof("osm:n:1002") }, null);
  const area = locations.signPlace({ id: "osm:n:1101", name: "Fixture area", label: "Fixture area, Fixture city", kind: "suburb", proof: proof("osm:n:1101", city.id) }, city.id);
  return { city, other, area, coverage: [{ city, entireCity: false, areas: [area] }] };
}
function fixture() {
  const p = places(); let current: Row | null = null; const audits: Row[] = []; const vendor = { id: "vendor-a", status: "approved" };
  const catalog = { id: "catalog-a", active: true, name: "Fixture service", category: "Fixture category", defaultPrice: 2500 };
  const db: Row = {
    vendor: { findFirst: async ({ where }: Row) => where.id === vendor.id && vendor.status === "approved" ? vendor : null },
    serviceCatalog: { findFirst: async ({ where }: Row) => where.id === catalog.id && catalog.active ? catalog : null },
    serviceOffering: {
      findFirst: async ({ where }: Row) => current?.vendorId === where.vendorId && (where.catalogId ? current?.catalogId === where.catalogId && current?.id !== where.id?.not : current?.id === where.id) ? current : null,
      findUnique: async ({ where }: Row) => current?.id === where.id ? { ...current, vendor, catalog } : null,
      create: async ({ data }: Row) => current = { ...data, id: "listing-a", updatedAt: new Date() },
      update: async ({ data }: Row) => current = { ...current, ...data, updatedAt: new Date(Date.now() + 10) },
      updateMany: async ({ where, data }: Row) => { if (current?.id !== where.id || current?.vendorId !== where.vendorId || current?.moderationStatus !== where.moderationStatus) return { count: 0 }; Object.assign(current!, data); return { count: 1 }; },
    },
  };
  db.$transaction = async (work: (tx: Row) => unknown) => work(db);
  let adminAllowed = true; let vendorId = "vendor-a";
  const modules = {
    "@/lib/prisma": { prisma: db }, "@/lib/marketplace-api": marketplace,
    "@/lib/service-management": management, "@/lib/service-locations": locations, "@/lib/service-types": { SERVICE_TYPES: [] },
    "@/lib/vendor-auth-server": { getVendorFromSession: async () => ({ vendor: { id: vendorId, status: "approved" } }) },
    "@/lib/admin-rbac": { requireAdminPermission: async () => adminAllowed ? { admin: { id: "admin-a" } } : { response: new Response("Denied", { status: 403 }) }, writeAdminAudit: async (_tx: unknown, row: Row) => audits.push(row) },
  };
  const vendorApi = load("app/api/vendor/services/route.ts", modules), adminApi = load("app/api/admin/services/route.ts", modules);
  const body = { catalogId: catalog.id, description: "Actual submitted fixture scope", price: 3100, priceType: "FIXED", coverage: p.coverage, durationMinutes: 60, leadDays: 1, warranty: "One month", cancellationTerms: "Contact provider one day ahead", active: true };
  const request = (body: Row) => new Request("https://joro.pk/api/services", { method: "POST", headers: { origin: "https://joro.pk", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ...p, body, request, db, catalog, audits, vendorApi, adminApi, get: () => current!, setVendor: (id: string) => vendorId = id, denyAdmin: () => adminAllowed = false };
}
test("coverage rejects cross-city areas, changed names, duplicate selections and implicit whole-city coverage", () => {
  const { city, other, area, coverage } = places();
  assert.equal(locations.validateCoverage(coverage).length, 1);
  assert.throws(() => locations.validateCoverage([{ city: other, entireCity: false, areas: [area] }]), /does not belong/);
  assert.throws(() => locations.validateCoverage([{ city: { ...city, name: "Changed city" }, entireCity: true, areas: [] }]), /altered/);
  assert.equal(coverageSchema.safeParse([{ city, entireCity: false, areas: [] }]).success, false);
  assert.equal(coverageSchema.safeParse([...coverage, ...coverage]).success, false);
  assert.equal(coverageSchema.safeParse([{ city, entireCity: false, areas: [area, area] }]).success, false);
  assert.equal(coversLocation(coverage, city.id, area.id), true);
  assert.equal(coversLocation(coverage, city.id, "elsewhere"), false);
  assert.equal(coversLocation([{ city, entireCity: true, areas: [] }], city.id, "elsewhere"), true);
  assert.equal(coversLocation(null, city.id, area.id), false);
  locations.verifyLocationFilter(city.id, area.id, JSON.stringify(city), JSON.stringify(area));
  assert.throws(() => locations.verifyLocationFilter(other.id, area.id, JSON.stringify(other), JSON.stringify(area)), /belonging/);
  assert.match(coverageLabel(null, ["Legacy city"]), /not verified/);
});
test("prices reject malformed, zero, negative, infinite and excess precision values", () => {
  for (const value of [0, -1, NaN, Infinity, "2500", .001, 10000000]) assert.equal(management.moneyInput.safeParse(value).success, false);
  assert.equal(management.moneyInput.parse(2500.50), 2500.50);
});
test("vendor submission uses catalog identity but independent price, stays pending, and cannot self-approve", async () => {
  const f = fixture(); const result = await f.vendorApi.POST(f.request({ ...f.body, vendorId: "other", moderationStatus: "APPROVED" }));
  assert.equal(result.status, 200); assert.equal(f.get().vendorId, "vendor-a"); assert.equal(f.get().price, 3100); assert.equal(f.catalog.defaultPrice, 2500);
  assert.equal(f.get().name, f.catalog.name); assert.equal(f.get().moderationStatus, "PENDING_APPROVAL");
  assert.equal((await f.vendorApi.POST(f.request(f.body))).status, 409);
  assert.equal((await f.vendorApi.POST(f.request({ action: "availability", id: f.get().id, active: true }))).status, 403);
});
test("real catalog API validates and persists defaults, and vendor API returns active templates", async () => {
  const f = fixture(); const rows: Row[] = []; const audits: Row[] = [];
  f.db.serviceCatalog.create = async ({ data }: Row) => { const row = { id: "new-catalog", ...data }; rows.push(row); return row; };
  f.db.serviceCatalog.findMany = async () => rows.filter(row => row.active);
  f.db.serviceOffering.findMany = async () => [];
  f.db.product = { findMany: async () => [] }; f.db.productServiceAddon = { findMany: async () => [] }; f.db.orderService = { count: async () => 0 };
  const catalogApi = load("app/api/admin/services/catalog/route.ts", {
    "@/lib/prisma": { prisma: f.db }, "@/lib/marketplace-api": marketplace, "@/lib/service-management": management,
    "@/lib/admin-rbac": { requireAdminPermission: async () => ({ admin: { id: "admin-a" } }), writeAdminAudit: async (_tx: unknown, row: Row) => audits.push(row) },
  });
  const body = { name: "Actual catalog API fixture", category: "Home services", description: "Catalog scope", defaultPrice: 2500, priceType: "STARTING_FROM", active: true };
  assert.equal((await catalogApi.POST(f.request({ ...body, defaultPrice: 0 }))).status, 400);
  assert.equal((await catalogApi.POST(f.request(body))).status, 200);
  const response = await f.vendorApi.GET(); const data = await response.json();
  assert.equal(data.catalog[0].defaultPrice, 2500); assert.equal(audits.length, 1);
  rows[0].active = false; assert.equal((await (await f.vendorApi.GET()).json()).catalog.length, 0);
});
test("admin can reject, vendor corrects and resubmits, approval preserves vendor availability, edits hide until review", async () => {
  const f = fixture(); await f.vendorApi.POST(f.request({ ...f.body, active: false }));
  const review = (action: string) => f.adminApi.PATCH(f.request({ id: f.get().id, version: f.get().updatedAt.toISOString(), action, reason: "Reviewed evidence" }));
  assert.equal((await review("reject")).status, 200); assert.equal(f.get().moderationStatus, "REJECTED");
  assert.equal((await f.vendorApi.POST(f.request({ ...f.body, active: false, id: f.get().id, version: f.get().updatedAt.toISOString() }))).status, 200);
  assert.equal((await review("approve")).status, 200); assert.equal(f.get().moderationStatus, "APPROVED"); assert.equal(f.get().active, false);
  assert.equal((await review("hide")).status, 200); assert.equal((await review("restore")).status, 200); assert.equal(f.get().active, false);
  assert.equal((await f.vendorApi.POST(f.request({ ...f.body, id: f.get().id, version: f.get().updatedAt.toISOString(), price: 4000 }))).status, 200);
  assert.equal(f.get().moderationStatus, "PENDING_APPROVAL"); assert.equal(f.audits.length, 4);
});
test("other vendors and stale reviewers cannot modify a listing; inactive catalog cannot be newly selected", async () => {
  const f = fixture(); await f.vendorApi.POST(f.request(f.body));
  f.setVendor("vendor-b"); assert.equal((await f.vendorApi.POST(f.request({ ...f.body, id: f.get().id, version: f.get().updatedAt.toISOString() }))).status, 404);
  assert.equal((await f.adminApi.PATCH(f.request({ id: f.get().id, version: "stale", action: "approve", reason: "Evidence reviewed" }))).status, 409);
  f.catalog.active = false; f.setVendor("vendor-a"); assert.equal((await f.vendorApi.POST(f.request(f.body))).status, 400);
  f.denyAdmin(); assert.equal((await f.adminApi.POST(f.request({ ...f.body, vendorId: "vendor-a" }))).status, 403);
});
test("admin-created listings require real approved vendor and record administrative attribution", async () => {
  const f = fixture(); assert.equal((await f.adminApi.POST(f.request({ ...f.body, vendorId: "nonexistent" }))).status, 400);
  assert.equal((await f.adminApi.POST(f.request({ ...f.body, vendorId: "vendor-a" }))).status, 200);
  assert.equal(f.get().vendorId, "vendor-a"); assert.equal(f.get().createdByAdmin, "admin-a"); assert.equal(f.get().reviewedBy, "admin-a"); assert.equal(f.get().moderationStatus, "APPROVED"); assert.equal(f.audits.length, 1);
});
test("provider result filtering excludes foreign places, POIs, streets and ambiguous districts", () => {
  const { city } = places(); const base = { place_id: "fixture", formatted: "Fixture", country_code: "pk", name: "Fixture" };
  assert.equal(locations.eligiblePlace({ ...base, result_type: "city" }), true);
  assert.equal(locations.eligiblePlace({ ...base, result_type: "suburb" }, city), true);
  for (const result_type of ["amenity", "building", "street", "district", "postcode", "city"]) assert.equal(locations.eligiblePlace({ ...base, result_type }, city), false);
  assert.equal(locations.eligiblePlace({ ...base, result_type: "city", country_code: "in" }), false);
});
test("missing provider key and upstream failures fail closed, provider searches are city-bound and cached", async () => {
  const { city } = places(); const oldKey = process.env.GEOAPIFY_API_KEY; const originalFetch = globalThis.fetch;
  try {
    delete process.env.GEOAPIFY_API_KEY; await assert.rejects(locations.searchServiceLocations("fixture-no-key"), /not configured/);
    process.env.GEOAPIFY_API_KEY = "test-only-not-a-real-key"; let calls = 0;
    globalThis.fetch = async input => {
      calls++; const url = new URL(String(input));
      if (url.pathname.endsWith('autocomplete')) { assert.equal(url.searchParams.get('filter'), 'countrycode:pk'); assert.equal(url.searchParams.get('bias'), 'proximity:74.3,31.5'); return new Response(JSON.stringify({ results: [{ place_id: 'fixture-upstream-area', name: 'Verified fixture', result_type: 'suburb', country_code: 'pk', formatted: 'Verified fixture, Fixture city' }] })); }
      if (url.pathname.endsWith('place-details')) return new Response(JSON.stringify({features:[{properties:{feature_type:'details',name:'Verified fixture',city:'Fixture city',country_code:'pk',lon:74.2,lat:31.5,datasource:{sourcename:'openstreetmap',raw:{place:'suburb',osm_id:1102,osm_type:'n'}}}}]}));
      return new Response(JSON.stringify({features:[{properties:{country_code:'pk',datasource:{sourcename:'openstreetmap',raw:{boundary:'administrative',admin_level:6,osm_id:600,osm_type:'r'}}}}]}));
    };
    const results = await locations.searchServiceLocations("Verified fixture", city); assert.equal(results.length, 1); locations.verifyPlace(results[0], city.id);
    await locations.searchServiceLocations("Verified fixture", city); assert.equal(calls, 3);
    globalThis.fetch = async () => { throw new Error("offline"); }; await assert.rejects(locations.searchServiceLocations("fixture-offline"), /unavailable/);
  } finally { globalThis.fetch = originalFetch; if (oldKey === undefined) delete process.env.GEOAPIFY_API_KEY; else process.env.GEOAPIFY_API_KEY = oldKey; }
});
test("city-only add-on checkout retains legacy services and rejects area-limited coverage", async () => {
  const p = places(); assert.equal(supportsCityOnlyCheckout(null), true); assert.equal(supportsCityOnlyCheckout(p.coverage), false);
  assert.equal(supportsCityOnlyCheckout([{ city: p.city, entireCity: true, areas: [] }], p.city.name), true);
  const tx = { productServiceAddon: { findUnique: async () => ({ active: true, product: { isActive: true, vendorPublication: { vendorId: "v", status: "active" } }, service: { vendorId: "v", active: true, moderationStatus: "APPROVED", vendor: { status: "approved" }, coverage: p.coverage } }) } } as unknown as Prisma.TransactionClient;
  await assert.rejects(resolveServiceAddon(tx, "p", "s", 1, p.city.name), /area-specific/);
});
test("booking admin APIs enforce permissions before querying or changing bookings", async () => {
  const permissions: string[] = [];
  const api = load("app/api/services/bookings/route.ts", {
    "@/lib/customer-service-policy": {}, "@/lib/prisma": { prisma: {} }, "@/lib/marketplace-api": marketplace,
    "@/lib/vendor-auth-server": {}, "@/lib/service-quote-fulfillment": {},
    "@/lib/admin-rbac": { requireAdminPermission: async (permission: string) => { permissions.push(permission); return { response: NextResponse.json({ error: "Denied" }, { status: 403 }) }; } },
  });
  assert.equal((await api.GET(new Request("https://joro.pk/api/services/bookings?role=admin"))).status, 403);
  assert.equal((await api.PATCH(new Request("https://joro.pk/api/services/bookings", { method: "PATCH", body: JSON.stringify({ id: "booking", role: "admin", status: "COMPLETED", note: "Completion evidence" }) }))).status, 403);
  assert.deepEqual(permissions, ["orders.view", "orders.manage"]);
});
test("public queries enforce approved provider/listing and matching area within matching city", async () => {
  let query: Row = {};
  const publicApi = load("lib/public-services.ts", { "@/lib/prisma": { prisma: { serviceOffering: { findMany: async (input: Row) => { query = input; return []; } } } } });
  await publicApi.publicServices({ cityId: "city-a", areaId: "area-a" });
  assert.equal(query.where.active, true); assert.equal(query.where.moderationStatus, "APPROVED"); assert.equal(query.where.vendor.status, "approved");
  const conditions = JSON.parse(JSON.stringify(query.where.AND)); assert.deepEqual(conditions[0].coverage.array_contains, [{ city: { id: "city-a", proof: { version: 2 } } }]);
  assert.deepEqual(conditions[1].OR[0].coverage.array_contains, [{ city: { id: "city-a", proof: { version: 2 } }, entireCity: true }]);
  assert.deepEqual(conditions[1].OR[1].coverage.array_contains, [{ city: { id: "city-a", proof: { version: 2 } }, areas: [{ id: "area-a", proof: { version: 2, citySourceId: "city-a" } }] }]);
});
