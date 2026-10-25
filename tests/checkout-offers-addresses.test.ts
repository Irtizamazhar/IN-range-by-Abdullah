import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { checkoutQuote } from "../lib/offer-checkout-service";
import { saveOrderAddress } from "../lib/checkout-address-preference";
import { resolveServiceAddon } from "../lib/service-checkout-service";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { z } from "zod";
import { ApiError } from "../lib/marketplace-api";
import * as offerService from "../lib/offer-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Partial Prisma delegates intentionally use flexible isolated fixtures.
type Row = Record<string, any>;
const future = () => new Date(Date.now() + 86400000);
function quoteFixture(requestType = "GIFT", productId: string | null = null) {
  const quote = { id: "quote-1", customerId: "a", orderId: null, expiresAt: future(), revision: { productId, quantity: 2, expiresAt: future(), offer: { vendorId: "vendor-a", status: "ACCEPTED" } }, want: { requestType, status: "OPEN", expiresAt: future(), city: "Lahore" } };
  let catalogReads = 0;
  const db: Row = { offerQuote: { findFirst: async ({ where }: Row) => where.customerId === quote.customerId ? quote : null }, vendor: { findFirst: async () => ({ id: "vendor-a" }) }, product: { findFirst: async ({ where }: Row) => { catalogReads++; assert.equal(where.vendorPublication.vendorId, "vendor-a"); return { id: productId, variants: [] }; } } };
  return { quote, db, tx: db as unknown as Prisma.TransactionClient, reads: () => catalogReads };
}

test("accepted service and bespoke gift quotes need no invented product; linked gifts keep catalog validation", async () => {
  for (const type of ["SERVICE", "GIFT"]) {
    const f = quoteFixture(type);
    assert.equal((await checkoutQuote(f.tx, "quote-1", "a", " Lahore ")).id, "quote-1");
    assert.equal(f.reads(), 0);
  }
  const linked = quoteFixture("GIFT", "catalog-product");
  await checkoutQuote(linked.tx, "quote-1", "a", "Lahore");
  assert.equal(linked.reads(), 1);
  const product = quoteFixture("PRODUCT");
  await assert.rejects(checkoutQuote(product.tx, "quote-1", "a", "Lahore"), /Link an active catalog product/);
});

test("foreign, expired, rejected, closed, wrong-city and unavailable-provider quotes are rejected", async () => {
  const foreign = quoteFixture();
  await assert.rejects(checkoutQuote(foreign.tx, "quote-1", "b", "Lahore"), /Quote not found/);
  for (const change of [(q: Row) => q.expiresAt = new Date(0), (q: Row) => q.revision.expiresAt = new Date(0), (q: Row) => q.want.expiresAt = new Date(0), (q: Row) => q.want.status = "CANCELLED", (q: Row) => q.revision.offer.status = "REJECTED"]) {
    const f = quoteFixture(); change(f.quote);
    await assert.rejects(checkoutQuote(f.tx, "quote-1", "a", "Lahore"), /expired or is no longer/);
  }
  await assert.rejects(checkoutQuote(foreign.tx, "quote-1", "a", "Karachi"), /city must match/);
  foreign.db.vendor.findFirst = async () => null;
  await assert.rejects(checkoutQuote(foreign.tx, "quote-1", "a", "Lahore"), /provider is no longer/);
});

function addressFixture() {
  const addresses: Row[] = [];
  const events: Row[] = [];
  const order = { id: "order-a", customerId: "a", customerName: "Ali Khan", customerPhone: "+923001234567", customerAddress: "12 Street, Apartment 2", city: "Lahore", statusEvents: [{ details: { addresses: { shipping: { postalCode: "54000" }, billing: { address: "Different billing" } } } }] };
  const db = {
    order: { findFirst: async ({ where }: Row) => where.customerId === order.customerId && where.id === order.id ? order : null },
    customerAddress: {
      findFirst: async ({ where }: Row) => addresses.find(a => a.customerId === where.customerId && a.isDefault) || null,
      create: async ({ data }: Row) => { const row = { id: `address-${addresses.length}`, ...data }; addresses.push(row); return row; },
      update: async ({ where, data }: Row) => { const row = addresses.find(a => a.id === where.id && a.customerId === where.customerId); assert.ok(row); Object.assign(row, data); return row; },
    },
    orderStatusEvent: { findUnique: async ({ where }: Row) => events.find(e => e.idempotencyKey === where.idempotencyKey) || null, create: async ({ data }: Row) => { events.push(data); return data; } },
  };
  return { order, addresses, events, tx: db as unknown as Prisma.TransactionClient };
}

test("saving a committed delivery address persists supported fields, updates the default, and deduplicates retries", async () => {
  const f = addressFixture();
  await saveOrderAddress(f.tx, "a", "order-a");
  assert.equal(f.addresses.length, 1);
  assert.equal(f.addresses[0].recipientName, "Ali Khan");
  assert.equal(f.addresses[0].address, "12 Street, Apartment 2");
  assert.equal(f.addresses[0].postalCode, "54000");
  assert.equal(f.addresses[0].isDefault, true);
  await saveOrderAddress(f.tx, "a", "order-a");
  assert.equal(f.addresses.length, 1); assert.equal(f.events.length, 1);
  f.order.id = "order-next"; f.order.customerAddress = "New delivery address";
  await saveOrderAddress(f.tx, "a", "order-next");
  assert.equal(f.addresses.length, 1); assert.equal(f.addresses[0].address, "New delivery address");
  await saveOrderAddress(f.tx, "a", "order-a").catch(() => {});
  assert.equal(f.addresses[0].address, "New delivery address");
});

test("customer B cannot save customer A's address, and missing orders cannot write preferences", async () => {
  const f = addressFixture();
  await assert.rejects(saveOrderAddress(f.tx, "b", "order-a"), /Order not found/);
  await assert.rejects(saveOrderAddress(f.tx, "a", "missing"), /Order not found/);
  assert.equal(f.addresses.length, 0); assert.equal(f.events.length, 0);
});

test("service add-on price is customer payable; configured commission is deducted only from provider settlement", async () => {
  const db = { productServiceAddon: { findUnique: async () => ({ active: true, product: { isActive: true, vendorPublication: { vendorId: "vendor-a", status: "active" } }, service: { id: "service", vendorId: "vendor-a", active: true, moderationStatus: "APPROVED", vendor: { status: "approved" }, cities: ["Lahore"], price: new Prisma.Decimal(500), name: "Assembly" } }) }, serviceCommissionRange: { findMany: async () => [{ minAmount: new Prisma.Decimal(0), maxAmount: new Prisma.Decimal(10000), isActive: true, commissionPercentage: new Prisma.Decimal(10) }] } };
  const tx = db as unknown as Prisma.TransactionClient;
  const service = await resolveServiceAddon(tx, "product", "service", 2, "Lahore");
  assert.equal(Number(service.price.mul(service.quantity)), 1000);
  assert.equal(Number(service.commissionAmount), 100);
  assert.equal(Number(service.vendorPayable), 900);
  await assert.rejects(resolveServiceAddon(tx, "product", "service", 1, "Karachi"), /unavailable in your delivery city/);
});

for (const requestType of ["SERVICE", "GIFT"]) test(`${requestType} offer acceptance snapshots server terms and replays the same quote`, async () => {
  let actorId = "a";
  const quotes: Row[] = [];
  const latest = { id: "revision", productId: null, price: new Prisma.Decimal(1800), quantity: 2, shipping: new Prisma.Decimal(0), expiresAt: future(), initiator: "VENDOR", delivery: "Two days", condition: "Any", warranty: "Agreed" };
  const offer = { id: "offer", vendorId: "vendor-a", wantId: "want", status: "SUBMITTED", vendor: { status: "approved", shopName: "Provider" }, want: { customerId: "a", status: "OPEN", expiresAt: future(), requestType, title: "Agreed requirement", city: "Lahore" }, revisions: [latest] };
  const db = {
    $transaction: async (fn: (tx: Row) => Promise<unknown>) => fn(db),
    wantOffer: { findUnique: async () => offer, update: async ({ data }: Row) => Object.assign(offer, data) },
    offerQuote: { findUnique: async () => quotes[0] || null, create: async ({ data }: Row) => { const row = { id: "quote", ...data }; quotes.push(row); return row; } },
    vendor: { findFirst: async () => ({ id: "vendor-a" }) },
  };
  const modules: Row = {
    zod: { z }, "@/lib/prisma": { prisma: db },
    "@/lib/marketplace-api": { ApiError, sameOrigin: () => {}, customerActor: async () => ({ id: actorId }), api: async (fn: () => Promise<unknown>) => { try { return Response.json(await fn()); } catch (e) { if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status }); throw e; } } },
    "@/lib/vendor-auth-server": { getVendorFromSession: async () => null },
    "@/lib/offer-service": offerService,
    "@/lib/marketplace-notifications": { notifyVendor: async () => {}, notifyCustomer: async () => {} },
  };
  const exported = {} as { PATCH: (request: Request, context: unknown) => Promise<Response> };
  runInNewContext(ts.transpileModule(readFileSync("app/api/offers/[id]/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exported, Date, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
  const accept = () => exported.PATCH(new Request("https://joro.pk/api/offers/offer", { method: "PATCH", body: JSON.stringify({ action: "accept", revisionId: "revision", idempotencyKey: randomUUID(), price: 1, shipping: 999 }) }), { params: { id: "offer" } });
  actorId = "b"; assert.equal((await accept()).status, 403); assert.equal(quotes.length, 0);
  actorId = "a"; latest.expiresAt = new Date(0); assert.equal((await accept()).status, 409); assert.equal(quotes.length, 0);
  latest.expiresAt = future(); assert.equal((await accept()).status, 200);
  assert.equal(quotes[0].snapshot.payable, "3600"); assert.equal(quotes[0].snapshot.shipping, "0");
  assert.equal(quotes[0].snapshot.productId, null); assert.equal(quotes[0].snapshot.vendorId, "vendor-a");
  assert.equal((await accept()).status, 200); assert.equal(quotes.length, 1);
});
