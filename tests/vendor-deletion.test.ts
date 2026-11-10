import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import { ApiError } from "../lib/marketplace-api";

type Calls = string[];
type DeletionModule = {
  deleteVendorAccount: (params: { vendorId: string; confirmEmail: string; adminId: string; adminEmail?: string }) => Promise<void>;
};

function fixture(history: Record<string, number> = {}) {
  const calls: Calls = [];
  const removed: string[] = [];
  const counter = (name: string) => ({ count: async () => history[name] ?? 0 });
  const deleter = (name: string) => ({ deleteMany: async () => { calls.push(`${name}.deleteMany`); return { count: 1 }; } });
  const db: Record<string, unknown> = {
    vendor: {
      findUnique: async () => ({ id: "vendor-a", email: "seller@example.invalid", shopName: "Shop", ownerName: "Owner", status: "approved" }),
      delete: async () => { calls.push("vendor.delete"); return {}; },
    },
    vendorShopOrder: counter("vendorShopOrder"), vendorOrder: counter("vendorOrder"), orderService: counter("orderService"),
    vendorEarning: counter("vendorEarning"), vendorWithdrawal: counter("vendorWithdrawal"), vendorLedgerEntry: counter("vendorLedgerEntry"),
    pickupRequest: counter("pickupRequest"), returnRequest: counter("returnRequest"), dispute: counter("dispute"),
    refund: counter("refund"), warrantyRecord: counter("warrantyRecord"), wantOffer: counter("wantOffer"),
    vendorProduct: { findMany: async () => [{ publishedProductId: "product-1" }, { publishedProductId: null }] },
    serviceOffering: { findMany: async () => [{ id: "service-1" }], ...deleter("serviceOffering") },
    supportTicket: { findMany: async () => [{ id: "ticket-1" }] },
    roomItem: deleter("roomItem"), productServiceAddon: deleter("productServiceAddon"),
    vendorPromotion: deleter("vendorPromotion"), storeSlugAlias: deleter("storeSlugAlias"), product: deleter("product"),
  };
  db.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(db);
  const modules: Record<string, unknown> = {
    "@prisma/client": { Prisma },
    "@/lib/prisma": { prisma: db },
    "@/lib/marketplace-api": { ApiError },
    "@/lib/admin-rbac": { writeAdminAudit: async (_db: unknown, data: { action: string }) => { calls.push(`audit:${data.action}`); } },
    "@/lib/private-storage": { removePrivateOwnerFolder: async (namespace: string, owner: string) => { removed.push(`${namespace}/${owner}`); } },
  };
  const exported = {} as DeletionModule;
  const js = ts.transpileModule(readFileSync("lib/vendor-deletion.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { exports: exported, console, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
  return { calls, removed, deleteVendorAccount: exported.deleteVendorAccount };
}

const params = { vendorId: "vendor-a", confirmEmail: "Seller@Example.invalid", adminId: "admin-1", adminEmail: "admin@example.invalid" };

test("a seller without business history is deleted with listings, services and private files", async () => {
  const f = fixture();
  await f.deleteVendorAccount(params);
  assert.ok(f.calls.indexOf("roomItem.deleteMany") < f.calls.indexOf("product.deleteMany"));
  assert.ok(f.calls.indexOf("product.deleteMany") < f.calls.indexOf("vendor.delete"));
  assert.ok(f.calls.includes("serviceOffering.deleteMany") && f.calls.includes("storeSlugAlias.deleteMany"));
  assert.ok(f.calls.includes("audit:vendor_delete"));
  assert.deepEqual(f.removed, ["vendor-docs/vendor-a", "vendor-appeals/vendor-a", "support/ticket-1"]);
});

test("a seller with orders or payouts cannot be deleted and nothing is removed", async () => {
  const f = fixture({ vendorShopOrder: 2, vendorWithdrawal: 1 });
  await assert.rejects(f.deleteVendorAccount(params), (e: unknown) => e instanceof ApiError && e.status === 409 && /2 orders, 1 withdrawals/.test(e.message));
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.removed, []);
});

test("deletion requires the seller's email as confirmation", async () => {
  const f = fixture();
  await assert.rejects(f.deleteVendorAccount({ ...params, confirmEmail: "other@example.invalid" }), (e: unknown) => e instanceof ApiError && e.status === 400);
  assert.deepEqual(f.calls, []);
});
