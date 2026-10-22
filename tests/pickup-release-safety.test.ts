import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";

type Row = Record<string, any>;
function loadService(path: string, modules: Row): Row {
  const exported: Row = {};
  const js = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { exports: exported, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; }, Date, Array, Error, Object, String });
  return exported;
}

test("a collected parcel cannot use ordinary cancellation or release inventory", async () => {
  const shop = { id: "shop-1", orderId: "parent", vendorId: "vendor", status: "packed", statusHistory: [] };
  const pickup = { id: "pickup-1", shopOrderId: shop.id, status: "collected", updatedAt: new Date(), history: [] };
  let releases = 0;
  let statusWrites = 0;
  const tx: Row = {
    pickupRequest: { findUnique: async () => pickup, updateMany: async () => { assert.fail("Collected pickup must not be cancelled"); } },
    vendorShopOrder: { updateMany: async ({ data }: Row) => { if (data.status !== "packed") statusWrites++; return { count: 1 }; } },
  };
  const db = { vendorShopOrder: { findFirst: async () => shop }, $transaction: async (fn: (tx: Row) => Promise<unknown>) => fn(tx) };
  const service = loadService("lib/order-cancellation-service.ts", {
    "@prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/lib/prisma": { prisma: db },
    "@/lib/vendor-shop-order-helpers": { appendStatusHistory: () => [], syncLineOrdersToShopStatus: async () => ({}) },
    "@/lib/order-inventory-service": { releaseReservedInventory: async () => { releases++; } },
    "@/lib/customer-notifications": { createCustomerNotification: async () => ({}) },
  });
  const result = await service.cancelSellerOrder({ shopOrderId: shop.id, reason: "Customer request", actorType: "admin" });
  assert.equal(result.ok, false);
  assert.match(result.error, /already collected/i);
  assert.equal(statusWrites, 0);
  assert.equal(releases, 0);
  assert.equal(pickup.status, "collected");
});

test("collection winning the pickup compare-and-swap aborts cancellation before inventory release", async () => {
  const shop = { id: "shop-1", orderId: "parent", vendorId: "vendor", status: "packed", statusHistory: [] };
  const pickup = { id: "pickup-1", shopOrderId: shop.id, status: "scheduled", updatedAt: new Date(), history: [] };
  let releases = 0;
  let statusWrites = 0;
  const tx: Row = { pickupRequest: { findUnique: async () => pickup, updateMany: async () => { pickup.status = "collected"; return { count: 0 }; } }, vendorShopOrder: { updateMany: async ({ data }: Row) => { if (data.status !== "packed") statusWrites++; return { count: 1 }; } } };
  const service = loadService("lib/order-cancellation-service.ts", {
    "@prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/lib/prisma": { prisma: { vendorShopOrder: { findFirst: async () => shop }, $transaction: async (fn: (tx: Row) => Promise<unknown>) => fn(tx) } },
    "@/lib/vendor-shop-order-helpers": { appendStatusHistory: () => [], syncLineOrdersToShopStatus: async () => ({}) },
    "@/lib/order-inventory-service": { releaseReservedInventory: async () => { releases++; } },
    "@/lib/customer-notifications": { createCustomerNotification: async () => ({}) },
  });
  const result = await service.cancelSellerOrder({ shopOrderId: shop.id, reason: "Customer request", actorType: "admin" });
  assert.equal(result.ok, false);
  assert.match(result.error, /pickup changed/i);
  assert.equal(statusWrites, 0);
  assert.equal(releases, 0);
});

test("cancellation reads a request created while waiting for the shop lock", async () => {
  const shop = { id: "shop-1", orderId: "parent", vendorId: "vendor", status: "packed", statusHistory: [] };
  const pickup = { id: "pickup-1", shopOrderId: shop.id, status: "collected", updatedAt: new Date(), history: [] };
  let lockTaken = false;
  let releases = 0;
  const tx: Row = {
    vendorShopOrder: { updateMany: async ({ data }: Row) => { assert.equal(data.status, "packed"); lockTaken = true; return { count: 1 }; } },
    pickupRequest: { findUnique: async () => { assert.equal(lockTaken, true); return pickup; } },
  };
  const service = loadService("lib/order-cancellation-service.ts", {
    "@prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/lib/prisma": { prisma: { vendorShopOrder: { findFirst: async () => shop }, $transaction: async (fn: (tx: Row) => Promise<unknown>) => fn(tx) } },
    "@/lib/vendor-shop-order-helpers": { appendStatusHistory: () => [], syncLineOrdersToShopStatus: async () => ({}) },
    "@/lib/order-inventory-service": { releaseReservedInventory: async () => { releases++; } },
    "@/lib/customer-notifications": { createCustomerNotification: async () => ({}) },
  });
  const result = await service.cancelSellerOrder({ shopOrderId: shop.id, reason: "Customer request", actorType: "admin" });
  assert.equal(result.ok, false);
  assert.match(result.error, /already collected/);
  assert.equal(releases, 0);
});

test("pre-collection cancellation still cancels pickup and releases inventory once", async () => {
  const shop = { id: "shop-1", orderId: "parent", vendorId: "vendor", customerId: null, status: "packed", statusHistory: [] };
  const pickup = { id: "pickup-1", shopOrderId: shop.id, visitId: null, status: "scheduled", updatedAt: new Date(), history: [] };
  let releases = 0;
  const tx: Row = {
    vendorShopOrder: { updateMany: async ({ where, data }: Row) => { if (shop.status !== where.status) return { count: 0 }; Object.assign(shop, data); return { count: 1 }; }, findMany: async () => [{ status: shop.status }] },
    pickupRequest: { findUnique: async () => pickup, updateMany: async ({ where, data }: Row) => { if (pickup.status !== where.status) return { count: 0 }; Object.assign(pickup, data); return { count: 1 }; } },
    vendorOrder: { findMany: async () => [] },
    orderInventoryLine: { count: async () => 1 },
    orderStatusEvent: { create: async () => ({}) },
  };
  const service = loadService("lib/order-cancellation-service.ts", {
    "@prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/lib/prisma": { prisma: { vendorShopOrder: { findFirst: async () => shop }, $transaction: async (fn: (tx: Row) => Promise<unknown>) => fn(tx) } },
    "@/lib/vendor-shop-order-helpers": { appendStatusHistory: () => [], syncLineOrdersToShopStatus: async () => ({}) },
    "@/lib/order-inventory-service": { releaseReservedInventory: async () => { releases++; } },
    "@/lib/customer-notifications": { createCustomerNotification: async () => ({}) },
  });
  const result = await service.cancelSellerOrder({ shopOrderId: shop.id, reason: "Customer request", actorType: "admin" });
  assert.equal(result.ok, true);
  assert.equal(shop.status, "cancelled");
  assert.equal(pickup.status, "cancelled");
  assert.equal(releases, 1);
});

test("admin tracking correction updates seller order, lines and pickup with audit in one transaction", async () => {
  const updatedAt = new Date("2026-10-22T00:00:00Z");
  const shop = { id: "shop-1", status: "shipped", trackingNumber: "OLD", updatedAt };
  const pickup = { id: "pickup-1", status: "handed_over", trackingNumber: "OLD", updatedAt, history: [] as Row[] };
  const line = { trackingNumber: "OLD" };
  const audits: Row[] = [];
  const tx: Row = {
    pickupRequest: { findUnique: async () => pickup, updateMany: async ({ where, data }: Row) => { if (pickup.status !== where.status || pickup.updatedAt !== where.updatedAt) return { count: 0 }; Object.assign(pickup, data); return { count: 1 }; } },
    vendorShopOrder: { updateMany: async ({ where, data }: Row) => { if (shop.status !== where.status || shop.updatedAt !== where.updatedAt) return { count: 0 }; Object.assign(shop, data); return { count: 1 }; } },
    vendorOrder: { updateMany: async ({ data }: Row) => { Object.assign(line, data); return { count: 1 }; } },
  };
  const service = loadService("lib/vendor-shop-order-service.ts", {
    "@/lib/prisma": { prisma: { vendorShopOrder: { findUnique: async () => shop }, $transaction: async (fn: (tx: Row) => Promise<unknown>) => fn(tx) } },
    "@/lib/vendor-shop-order-helpers": {}, "@/lib/order-cancellation-service": {}, "@/lib/order-inventory-service": {},
    "@/lib/admin-rbac": { writeAdminAudit: async (_tx: Row, data: Row) => { audits.push(data); } },
    "@/lib/marketplace-api": { ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message); } } },
  });
  assert.equal((await service.updateShippedTrackingOnly({ shopOrderId: shop.id, actor: "admin", adminId: "admin-1", trackingNumber: " NEW " })).ok, true);
  assert.equal(shop.trackingNumber, "NEW");
  assert.equal(pickup.trackingNumber, "NEW");
  assert.equal(line.trackingNumber, "NEW");
  assert.match(pickup.history.at(-1)!.note, /OLD to NEW/);
  assert.equal(audits[0].adminId, "admin-1");
  await assert.rejects(service.updateShippedTrackingOnly({ shopOrderId: shop.id, actor: "admin", adminId: "admin-1", trackingNumber: null }), /must keep a valid tracking number/);
});

test("legacy recovery API requires orders.manage and validated evidence", async () => {
  let allowed = false;
  let recoveries = 0;
  const route = loadService("app/api/orders/admin/pickups/recover/route.ts", {
    zod: { z },
    "@/lib/marketplace-api": { api: async (work: () => Promise<unknown>) => work(), sameOrigin: () => {} },
    "@/lib/admin-rbac": { requireAdminPermission: async (permission: string) => { assert.equal(permission, "orders.manage"); return allowed ? { admin: { id: "admin-1" } } : { response: new Response(null, { status: 403 }) }; } },
    "@/lib/pickup-workflow": { recoverLegacyPickup: async (input: Row) => { recoveries++; assert.equal(input.adminId, "admin-1"); return { id: "pickup-1" }; } },
  });
  const body = { shopOrderId: "shop-1", pickupAddress: "Verified pickup warehouse", pickupCity: "Lahore", contactName: "Seller contact", contactPhone: "03001234567", parcelCount: 1, reason: "Vendor account unavailable", evidence: "Signed parcel photo record", verifiedOrder: true };
  const request = () => new Request("https://joro.pk/api/orders/admin/pickups/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await route.POST(request())).status, 403);
  assert.equal(recoveries, 0);
  allowed = true;
  await assert.rejects(route.POST(new Request("https://joro.pk/api/orders/admin/pickups/recover", { method: "POST", body: JSON.stringify({ ...body, evidence: "" }) })), /evidence/i);
  assert.equal(recoveries, 0);
  assert.equal((await route.POST(request())).pickup.id, "pickup-1");
  assert.equal(recoveries, 1);
});
