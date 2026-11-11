import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import { ApiError } from "../lib/marketplace-api";

type Shop = { id: string; vendorId: string; status: string; vendorDeletedAt: Date | null };
type ServiceModule = {
  deleteShopOrderForVendor: (params: { shopOrderId: string; vendorId: string; reason?: string }) => Promise<{ ok: boolean; error?: string; status?: number }>;
};

function fixture(status: string, cancelResult: { ok: boolean; error?: string } = { ok: true }) {
  const shop: Shop = { id: "shop-a", vendorId: "vendor-a", status, vendorDeletedAt: null };
  const cancels: Array<{ reason: string; vendorId?: string }> = [];
  const matches = (where: Partial<Shop>) => Object.entries(where).every(([key, value]) => shop[key as keyof Shop] === value);
  const prisma = {
    vendorShopOrder: {
      findFirst: async ({ where }: { where: Partial<Shop> }) => (matches(where) ? { id: shop.id, status: shop.status } : null),
      updateMany: async ({ where, data }: { where: Partial<Shop>; data: Partial<Shop> }) => {
        if (!matches(where)) return { count: 0 };
        Object.assign(shop, data);
        return { count: 1 };
      },
    },
  };
  const modules: Record<string, unknown> = {
    "@prisma/client": { Prisma },
    "@/lib/prisma": { prisma },
    "@/lib/vendor-shop-order-helpers": { appendStatusHistory: () => [], nextShopStatus: () => null, syncLineOrdersToShopStatus: async () => {} },
    "@/lib/order-cancellation-service": {
      cancelSellerOrder: async (params: { reason: string; vendorId?: string }) => {
        cancels.push({ reason: params.reason, vendorId: params.vendorId });
        if (cancelResult.ok) shop.status = "cancelled";
        return cancelResult.ok ? { ok: true, alreadyCancelled: false } : cancelResult;
      },
    },
    "@/lib/order-inventory-service": { consumeReservedInventory: async () => 0, deductSellerInventoryOnConfirm: async () => 0 },
    "@/lib/admin-rbac": { writeAdminAudit: async () => {} },
    "@/lib/marketplace-api": { ApiError },
  };
  const exported = {} as ServiceModule;
  const js = ts.transpileModule(readFileSync("lib/vendor-shop-order-service.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { exports: exported, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
  return { shop, cancels, deleteShopOrderForVendor: exported.deleteShopOrderForVendor };
}

test("deleting an active order cancels it first, then removes it from the seller's list", async () => {
  const f = fixture("confirmed");
  // JSON round-trip: the module runs in a separate VM context with its own Object prototype.
  assert.deepEqual(JSON.parse(JSON.stringify(await f.deleteShopOrderForVendor({ shopOrderId: "shop-a", vendorId: "vendor-a" }))), { ok: true });
  assert.deepEqual(f.cancels, [{ reason: "Order deleted by the seller.", vendorId: "vendor-a" }]);
  assert.equal(f.shop.status, "cancelled");
  // The Date is created inside the VM context, so check its shape rather than instanceof.
  assert.equal(Object.prototype.toString.call(f.shop.vendorDeletedAt), "[object Date]");
});

test("delivered and cancelled orders are removed without another cancellation", async () => {
  for (const status of ["delivered", "cancelled"]) {
    const f = fixture(status);
    assert.equal((await f.deleteShopOrderForVendor({ shopOrderId: "shop-a", vendorId: "vendor-a" })).ok, true);
    assert.equal(f.cancels.length, 0); assert.ok(f.shop.vendorDeletedAt);
  }
});

test("shipped orders, other sellers' orders and failed cancellations are not deleted", async () => {
  const shipped = fixture("shipped");
  assert.equal((await shipped.deleteShopOrderForVendor({ shopOrderId: "shop-a", vendorId: "vendor-a" })).status, 409);
  assert.equal(shipped.shop.vendorDeletedAt, null);

  const other = fixture("pending");
  assert.equal((await other.deleteShopOrderForVendor({ shopOrderId: "shop-a", vendorId: "vendor-b" })).status, 404);
  assert.equal(other.cancels.length, 0); assert.equal(other.shop.vendorDeletedAt, null);

  const blocked = fixture("packed", { ok: false, error: "Pickup already collected" });
  const result = await blocked.deleteShopOrderForVendor({ shopOrderId: "shop-a", vendorId: "vendor-a" });
  assert.equal(result.ok, false); assert.equal(result.error, "Pickup already collected");
  assert.equal(blocked.shop.vendorDeletedAt, null);
});
