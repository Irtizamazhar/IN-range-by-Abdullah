import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { api, ApiError, sameOrigin } from "../lib/marketplace-api";

function fixture() {
  let owner: string | null = "customer-a";
  const records = new Set<string>();
  const prisma = { product: { findFirst: async ({ where }: { where: { id: string } }) => where.id === "p1" ? { id: "p1" } : null }, savedProduct: {
    findMany: async ({ where }: { where: { customerId: string } }) => { assert.ok(where.customerId); return Array.from(records).filter(key => key.startsWith(`${where.customerId}:`)).map(key => ({ productId: key.split(":")[1] })); },
    createMany: async ({ data, skipDuplicates }: { data: { customerId: string; productId: string }[]; skipDuplicates: boolean }) => { assert.equal(skipDuplicates, true); for (const row of data) records.add(`${row.customerId}:${row.productId}`); },
    deleteMany: async ({ where }: { where: { customerId: string; productId: string } }) => { assert.ok(where.customerId); records.delete(`${where.customerId}:${where.productId}`); },
  } };
  const modules: Record<string, unknown> = { zod: { z }, "@/lib/prisma": { prisma }, "@/lib/marketplace-api": { api, ApiError, sameOrigin, customerActor: async () => { if (!owner) throw new ApiError(401, "Sign in required."); return { id: owner }; } }, "@/lib/customer-saved-products": { customerSavedProducts: async () => [] } };
  function load(file: string) {
    const exported: Record<string, (request: Request, context?: unknown) => Promise<Response>> = {};
    const js = ts.transpileModule(readFileSync(resolve(file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(js, { exports: exported, URL, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
    return exported;
  }
  const collection = load("app/api/customer/saved-products/route.ts"), item = load("app/api/customer/saved-products/[productId]/route.ts");
  const request = (method: string, body?: unknown) => new Request("https://joro.pk/api/customer/saved-products?idsOnly=1", { method, headers: { origin: "https://joro.pk", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { records, owner: (id: string | null) => { owner = id; }, get: () => collection.GET(request("GET")), save: (body: unknown = { productId: "p1" }) => collection.POST(request("POST", body)), remove: () => item.DELETE(request("DELETE"), { params: { productId: "p1" } }) };
}

test("existing saved-products APIs scope records to the authenticated owner, ignoring forged owner fields", async () => {
  const f = fixture();
  assert.equal((await f.save({ productId: "p1", customerId: "customer-b" })).status, 200);
  assert.deepEqual(Array.from(f.records), ["customer-a:p1"]);
  assert.deepEqual((await (await f.get()).json()).ids, ["p1"]);
  f.owner("customer-b");
  assert.deepEqual((await (await f.get()).json()).ids, []);
  await f.remove(); assert.ok(f.records.has("customer-a:p1"));
  f.owner("customer-a");
  assert.deepEqual((await (await f.get()).json()).ids, ["p1"], "saved state survives a later authenticated session");
});

test("existing save/remove operations are idempotent; unavailable products and anonymous access are rejected", async () => {
  const f = fixture();
  await Promise.all([f.save(), f.save(), f.save()]); assert.equal(f.records.size, 1);
  assert.equal((await f.save({ productId: "unavailable" })).status, 404);
  await f.remove(); await f.remove(); assert.equal(f.records.size, 0);
  f.owner(null);
  for (const response of await Promise.all([f.get(), f.save(), f.remove()])) assert.equal(response.status, 401);
});
