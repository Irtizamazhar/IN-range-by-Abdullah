import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import { ApiError } from "../lib/marketplace-api";

type Line = { id: string; vendorShopOrderId: string | null; orderId: string; productId: string | null; vendorProductId: string | null; quantity: number; state: string; createdAt: Date; orderItem: { name: string } };
type InventoryModule = {
  deductSellerInventoryOnConfirm: (tx: unknown, vendorShopOrderId: string) => Promise<number>;
  releaseReservedInventory: (tx: unknown, scope: { vendorShopOrderId: string }, reason: string) => Promise<number>;
};

function fixture(stock = 10) {
  const state = { listingStock: stock, listingSold: 0, productStock: stock };
  const lines: Line[] = [{ id: "line-1", vendorShopOrderId: "shop-a", orderId: "order-1", productId: "product-1", vendorProductId: "vp-1", quantity: 1, state: "awaiting_confirmation", createdAt: new Date(), orderItem: { name: "Shirt" } }];
  const matches = (line: Line, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => line[key as keyof Line] === value);
  const tx = {
    orderInventoryLine: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => lines.filter((l) => matches(l, where)),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Line> }) => {
        const hit = lines.filter((l) => matches(l, where));
        hit.forEach((l) => Object.assign(l, data));
        return { count: hit.length };
      },
    },
    vendorProduct: {
      updateMany: async ({ where, data }: { where: { stock: { gte: number } }; data: { stock: { decrement: number }; totalSold: { increment: number } } }) => {
        if (state.listingStock < where.stock.gte) return { count: 0 };
        state.listingStock -= data.stock.decrement; state.listingSold += data.totalSold.increment;
        return { count: 1 };
      },
    },
    product: {
      updateMany: async ({ where, data }: { where: { stock?: { gte: number } }; data: { stock: { decrement?: number; increment?: number } } }) => {
        if (where.stock && state.productStock < where.stock.gte) return { count: 0 };
        state.productStock += (data.stock.increment ?? 0) - (data.stock.decrement ?? 0);
        return { count: 1 };
      },
    },
    $executeRaw: async (_sql: TemplateStringsArray, quantity: number) => { state.listingStock += quantity; state.listingSold = Math.max(0, state.listingSold - quantity); return 1; },
  };
  const modules: Record<string, unknown> = { "@prisma/client": { Prisma }, "@/lib/marketplace-api": { ApiError } };
  const exported = {} as InventoryModule;
  const js = ts.transpileModule(readFileSync("lib/order-inventory-service.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { exports: exported, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
  return { state, lines, tx, ...exported };
}

test("confirming a seller order deducts its stock once (10 becomes 9)", async () => {
  const f = fixture(10);
  assert.equal(await f.deductSellerInventoryOnConfirm(f.tx, "shop-a"), 1);
  assert.equal(f.state.listingStock, 9); assert.equal(f.state.productStock, 9); assert.equal(f.state.listingSold, 1);
  assert.equal(f.lines[0].state, "reserved");
  assert.equal(await f.deductSellerInventoryOnConfirm(f.tx, "shop-a"), 0);
  assert.equal(f.state.listingStock, 9);
});

test("cancelling before confirmation restores nothing; after confirmation it restores the stock", async () => {
  const pending = fixture(10);
  await pending.releaseReservedInventory(pending.tx, { vendorShopOrderId: "shop-a" }, "Customer cancelled");
  assert.equal(pending.state.listingStock, 10); assert.equal(pending.state.productStock, 10);
  assert.equal(pending.lines[0].state, "released");

  const confirmed = fixture(10);
  await confirmed.deductSellerInventoryOnConfirm(confirmed.tx, "shop-a");
  await confirmed.releaseReservedInventory(confirmed.tx, { vendorShopOrderId: "shop-a" }, "Seller cancelled");
  assert.equal(confirmed.state.listingStock, 10); assert.equal(confirmed.state.productStock, 10);
});

test("confirmation is refused when the stock ran out after checkout", async () => {
  const f = fixture(0);
  await assert.rejects(f.deductSellerInventoryOnConfirm(f.tx, "shop-a"), (e: unknown) => e instanceof ApiError && e.status === 409 && /Not enough stock to confirm "Shirt"/.test(e.message));
  assert.equal(f.state.listingStock, 0);
});
