import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { calculateHandlingFee } from "../lib/handling-fee";
import { Prisma } from "@prisma/client";

test("fee preview never adds a separate customer charge", async () => {
  const products = new Set(["one", "two"]);
  const modules: Record<string, unknown> = {
    "rate-limiter-flexible": { RateLimiterMemory: class {} },
    "@/lib/marketplace-api": {
      api: async (fn: () => Promise<unknown>) => Response.json(await fn()),
      ApiError: class extends Error {},
      customerActor: async () => ({ id: "customer-1" }),
      sameOrigin: () => {},
    },
    "@/lib/security/rate-limit": { consumeOrReject: async () => ({ ok: true }) },
    "@/lib/prisma": { prisma: { product: { findFirst: async ({ where }: { where: { id: string } }) => products.has(where.id) ? { id: where.id } : null } } },
    "@/lib/handling-fee": { calculateHandlingFee },
    "@/lib/offer-checkout-service": { checkoutQuote: async () => ({ id: "quote-1", orderId: null, revision: { productId: "one", quantity: 1, price: new Prisma.Decimal(1000), shipping: new Prisma.Decimal(75) }, want: { requestType: "GIFT", city: "Lahore" } }) },
  };
  const exported = {} as { POST: (request: Request) => Promise<Response> };
  const js = ts.transpileModule(readFileSync("app/api/checkout/handling-fee/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { exports: exported, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
  const preview = async (body: unknown) => (await exported.POST(new Request("https://joro.pk/api/checkout/handling-fee", { method: "POST", body: JSON.stringify(body) }))).json() as Promise<{ handlingFee: number }>;

  assert.equal((await preview({ products: [{ productId: "one", quantity: 1 }] })).handlingFee, 0);
  assert.equal((await preview({ products: [{ productId: "one", quantity: 3 }, { productId: "two", quantity: 2 }], couponCode: "SAVE" })).handlingFee, 0);
  assert.equal((await preview({ products: [{ productId: "one", quantity: 1 }], quoteId: "quote-1" })).handlingFee, 0);
});
