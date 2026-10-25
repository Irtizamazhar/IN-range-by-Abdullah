import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError } from "../lib/marketplace-api";
import { checkoutAddresses } from "../lib/checkout-addresses";
import { checkoutDiagnostic, checkoutFailure } from "../lib/checkout-diagnostics";
import { readCheckoutReceipt, checkoutAttemptKey, clearCheckoutAttempt } from "../lib/checkout-response";
import { resolveServiceAddon } from "../lib/service-checkout-service";
import { calculateHandlingFee } from "../lib/handling-fee";
import { queueOrderConfirmation } from "../lib/order-confirmation-delivery";
import * as couponService from "../lib/coupon-service";

const payload = { customerName: "Ali Khan", customerPhone: "03001234567", customerAddress: "12 Street, Apartment 2", city: "Lahore", paymentMethod: "cod", products: [{ productId: "cream", quantity: 1 }], expectedHandlingFee: 0 };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Partial Prisma delegates intentionally use flexible isolated fixtures.
type Row = Record<string, any>;
function fixture() {
  const state = { orders: [] as Row[], items: [] as Row[], bundles: [] as Row[], vendorOrders: [] as Row[], events: [] as Row[], services: [] as Row[], jobs: [] as Row[], stocks: { cream: 5, soap: 5 } as Record<string, number> };
  const logs: unknown[] = [];
  const options = { signedIn: true, failAt: "", smtpFails: false, failReceipt: false, foreignOwner: false, coupon: false, vendorFundedCoupon: false, quote: false, quoteType: "PRODUCT", productlessQuote: false, quoteShipping: 75, outboxMissing: false, transactionStockRace: false, deliveryCharge: 100 };
  const products: Record<string, Row> = { cream: { id: "cream", name: "cream", price: new Prisma.Decimal(2000), stock: 5, isActive: true, variants: [], category: "Skin", categoryRecordId: null, originalPrice: null }, soap: { id: "soap", name: "soap", price: new Prisma.Decimal(500), stock: 5, isActive: true, variants: [], category: "Skin", categoryRecordId: null, originalPrice: null } };
  const owners = new Map<string, string>();
  const error = (code: string, column?: string) => Object.assign(new Error("PRIVATE SQL password=secret"), { code, meta: { modelName: "OrderConfirmationEmail", column } });
  const db: Row = {
    customer: { findUnique: async () => { if (options.failAt === "customer") throw error("P2022", "order.handlingFee"); return { id: "customer-a", email: "owner@example.invalid" }; } },
    order: {
      findUnique: async ({ where }: Row) => { if (where.id && options.failReceipt) throw error("P2022", "order.missing"); return state.orders.find(o => where.checkoutKey ? o.checkoutKey === where.checkoutKey : o.id === where.id) || null; },
      create: async ({ data }: Row) => { if (state.orders.some(o => o.checkoutKey === data.checkoutKey)) throw error("P2002"); const row = { ...data, id: "order-" + (state.orders.length + 1) }; state.orders.push(row); return row; },
    },
    product: { findUnique: async ({ where }: Row) => products[where.id] || null, findFirst: async ({ where }: Row) => products[where.id] || null, updateMany: async ({ where, data }: Row) => { if (options.transactionStockRace || state.stocks[where.id] < where.stock.gte) return { count: 0 }; state.stocks[where.id] -= data.stock.decrement; return { count: 1 }; } },
    vendorProduct: { findFirst: async ({ where }: Row) => { const vendorId = owners.get(where.publishedProductId); return vendorId ? { id: "vp-" + where.publishedProductId, vendorId, stock: 5, category: "Skin", vendor: { id: vendorId, status: "approved", specialCommissionRate: null } } : null; }, updateMany: async () => ({ count: 1 }) },
    vendorShopOrder: { create: async ({ data }: Row) => { const row = { ...data, id: "bundle-" + data.vendorId }; state.bundles.push(row); return row; }, findMany: async ({ where }: Row) => state.bundles.filter(b => b.orderId === where.orderId) },
    vendorOrder: { create: async ({ data }: Row) => { const row={id:"vendor-line-"+state.vendorOrders.length,...data}; state.vendorOrders.push(row); return row; } }, vendor: { update: async () => ({}) },
    offerQuote: { updateMany: async () => ({ count: 1 }) }, want: { update: async () => ({}) },
    productServiceAddon: { findUnique: async () => ({ active: true, product: { isActive: true, vendorPublication: { vendorId: "vendor-a", status: "active" } }, service: { active: true, moderationStatus: "APPROVED", vendor: { status: "approved" }, vendorId: "vendor-a", price: new Prisma.Decimal(500), cities: ["Lahore"], name: "Assembly", description: "Fixture", warranty: "", cancellationTerms: "", durationMinutes: 30, leadDays: 1 } }) },
    serviceCommissionRange: { findMany: async () => [{ minAmount: new Prisma.Decimal(0), maxAmount: new Prisma.Decimal(10000), isActive: true, commissionPercentage: new Prisma.Decimal(10) }] },
    vendorNotification: { create: async () => ({}) },
    orderService: { create: async ({ data }: Row) => { const row={id:"service-booking-"+state.services.length,...data};state.services.push(row); return row; } },
    orderItem: { create: async ({ data }: Row) => { const row = { ...data, id: "item-" + state.items.length }; state.items.push(row); return row; } },
    orderInventoryLine: { create: async () => ({}) },
    orderStatusEvent: { create: async ({ data }: Row) => { state.events.push(data); return data; } },
    commissionSetting: { findUnique: async () => ({ commissionPercentage: 10 }) },
    orderConfirmationEmail: { upsert: async ({ create }: Row) => { if (options.outboxMissing) throw error("P2022", "OrderConfirmationEmail.recipientKey"); if (!state.jobs.some(j => j.orderId === create.orderId && j.recipientKey === create.recipientKey)) state.jobs.push(create); return create; } },
    couponRedemption: { count: async () => 0, create: async () => ({}) }, vendorCoupon: { updateMany: async () => ({ count: 1 }) },
  };
  db.$transaction = async (fn: (tx: Row) => Promise<unknown>) => {
    const saved = { ...state, orders: [...state.orders], items: [...state.items], bundles: [...state.bundles], vendorOrders: [...state.vendorOrders], events: [...state.events], services: [...state.services], jobs: [...state.jobs], stocks: { ...state.stocks } };
    try { if (options.failAt === "transaction") throw error("P2034"); return await fn(db); }
    catch (e) { Object.assign(state, saved); throw e; }
  };
  const modules: Row = {
    "next/server": { NextResponse }, "node:crypto": { randomUUID }, "@prisma/client": { Prisma },
    "@/lib/prisma": { prisma: db }, "@/lib/marketplace-api": { ApiError },
    "@/lib/checkout-addresses": { checkoutAddresses }, "@/lib/checkout-diagnostics": { checkoutDiagnostic, checkoutFailure },
    "@/lib/sessions": { getCustomerSession: async () => options.signedIn ? { user: { id: "customer-a", email: "owner@example.invalid", role: "customer" } } : null },
    "@/lib/admin-rbac": {}, "@/lib/auto-cancel-orders": {},
    "@/lib/settings-db": { getOrCreateSettings: async () => ({ codAvailableCities: ["Lahore"], codCharges: options.deliveryCharge }) },
    "@/lib/order-number": { generateOrderNumber: async () => "IRB-001" },
    "@/lib/catalog-product-select": { catalogProductSelect: () => ({ id: true }) },
    "@/lib/prisma-order-includes": { ORDER_INCLUDE_SERIALIZE: {} },
    "@/lib/order-emails": { notifyAdminNewOrder: async () => { if (options.smtpFails) throw Error("SMTP credentials secret"); } },
    "@/lib/order-confirmation-delivery": { queueOrderConfirmation },
    "@/lib/vendor-notifications": { createVendorNotification: async () => {} },
    "@/lib/serialize": { primaryProductImageUrl: () => "", serializeOrder: (o: Row) => ({ _id: o.id, orderNumber: o.orderNumber, customerPhone: o.customerPhone, customerName: o.customerName, customerEmail: o.customerEmail, totalAmount: Number(o.totalAmount), handlingFee: Number(o.handlingFee) }) },
    "@/lib/vendor-commission": { resolveCommissionPercent: async () => 10 }, "@/lib/handling-fee": { calculateHandlingFee },
    "@/lib/coupon-service": { ...couponService, findCoupon: async () => { if (!options.coupon) throw new ApiError(400, "Coupon is inactive."); return { id: "coupon", couponCode: "SAVE", status: "active", ownerType: options.vendorFundedCoupon ? "VENDOR" : "ADMIN", vendorId: options.vendorFundedCoupon ? "vendor-a" : null, approvedAt: new Date(), approvals: [], selectedVendorIds: [], productIds: ["cream"], categories: [], customerIds: [], fundingType: options.vendorFundedCoupon ? "VENDOR_FUNDED" : "PLATFORM_FUNDED", discountType: "fixed", discountValue: 100, minOrderAmount: 0, maxDiscount: null, maxUses: null, perCustomerLimit: null, budget: null, spent: 0 }; } },
    "@/lib/vendor-shop-order-number": { generateVendorShopOrderNumber: async () => "SHOP-" + state.bundles.length },
    "@/lib/marketplace-prisma": { getMarketplacePrisma: () => db, getMarketplaceTx: () => db },
    "@/lib/offer-checkout-service": { checkoutQuote: async () => options.quote ? { id: "quote-1", orderId: null, wantId: "want-1", want: { requestType: options.quoteType, category: "Skin", title: "Agreed request" }, revision: { offer: { vendorId: "vendor-a", vendor: { specialCommissionRate: null } }, productId: options.productlessQuote ? null : "cream", quantity: 1, price: new Prisma.Decimal(1800), shipping: new Prisma.Decimal(options.quoteShipping) } } : null }, "@/lib/service-checkout-service": { resolveServiceAddon },
  };
  const exported = {} as { POST: (request: Request) => Promise<Response> };
  const js = ts.transpileModule(readFileSync("app/api/orders/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { exports: exported, Error, console: { error: (...args: unknown[]) => logs.push(args) }, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
  const post = (body: Row = payload, key = "checkout-request-123456") => exported.POST(new Request("https://joro.pk/api/orders", { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) }));
  return { state, options, post, owners, products, logs };
}

test("COD checkout records correct totals/status/addresses/outbox and replays the same order", async () => {
  const f = fixture(); const first = await f.post(); assert.equal(first.status, 200); assert.equal((await first.json()).orderNumber, "IRB-001");
  assert.equal(Number(f.state.orders[0].totalAmount), 2100); assert.equal(Number(f.state.orders[0].handlingFee), 0);
  assert.equal(f.state.orders[0].paymentStatus, "pending"); assert.equal(f.state.orders[0].orderStatus, "confirmed");
  assert.equal(f.state.events[0].details.addresses.billing.address, payload.customerAddress);
  assert.equal(f.state.stocks.cream, 4); assert.equal(f.state.jobs.length, 1);
  assert.equal((await f.post()).headers.get("X-Idempotent-Replay"), "true"); assert.equal(f.state.orders.length, 1); assert.equal(f.state.stocks.cream, 4);
});
test("different billing address is preserved in the existing order-created event", async () => {
  const f = fixture(); const response = await f.post({ ...payload, sameBillingAddress: false, billingAddress: { name: "Company", address: "20 Billing Street", city: "Karachi", country: "Pakistan", postalCode: "74000" } });
  assert.equal(response.status, 200); assert.equal(f.state.events[0].details.addresses.billing.address, "20 Billing Street"); assert.equal(f.state.orders[0].customerAddress, payload.customerAddress);
});
test("multi-vendor products retain grouping, stock, fees, totals and separate notification keys", async () => {
  const f = fixture(); f.owners.set("cream", "vendor-a"); f.owners.set("soap", "vendor-b");
  const response = await f.post({ ...payload, products: [...payload.products, { productId: "soap", quantity: 2 }] });
  assert.equal(response.status, 200); assert.equal(Number(f.state.orders[0].totalAmount), 3100); assert.equal(Number(f.state.orders[0].handlingFee), 0); assert.equal(f.state.bundles.length, 2);
  assert.equal(f.state.bundles[0].items[0].productName, "cream"); assert.equal(f.state.bundles[1].items[0].productName, "soap");
  assert.deepEqual(f.state.vendorOrders.map(o => Number(o.commissionAmount)), [0, 0]);
  assert.deepEqual(f.state.vendorOrders.map(o => Number(o.vendorAmount)), [2000, 1000]);
  assert.deepEqual(f.state.jobs.map(j => j.recipientKey), ["customer", "vendor:bundle-vendor-a", "vendor:bundle-vendor-b"]);
});
test("three units use the configured delivery charge and the client-visible total matches the server", async () => {
  const f = fixture();
  const response = await f.post({ ...payload, products: [{ productId: "cream", quantity: 3 }] });
  assert.equal(response.status, 200);
  const clientTotal = 2000 * 3 + 100;
  assert.equal(Number(f.state.orders[0].handlingFee), 0);
  assert.equal(Number(f.state.orders[0].totalAmount), clientTotal);
  const receipt = await readCheckoutReceipt(response);
  assert.equal(receipt.handlingFee, 0);
  assert.equal(receipt.totalAmount, clientTotal);
});
test("free delivery and delivery below Rs. 50 stay at the configured amount", async () => {
  for (const charge of [0, 25]) {
    const f = fixture(); f.options.deliveryCharge = charge;
    const response = await f.post();
    assert.equal(response.status, 200);
    assert.equal(Number(f.state.orders[0].handlingFee), 0);
    assert.equal(Number(f.state.orders[0].totalAmount), 2000 + charge);
  }
});
test("a stale client fee is rejected before an order is stored", async () => {
  const f = fixture();
  const response = await f.post({ ...payload, expectedHandlingFee: 51 });
  assert.equal(response.status, 409);
  assert.equal(f.state.orders.length, 0);
});
test("negotiated quote keeps zero customer fee and its existing vendor-deducted commission", async () => {
  const f = fixture(); f.options.quote = true; f.owners.set("cream", "vendor-a");
  const response = await f.post({ ...payload, quoteId: "quote-1", expectedHandlingFee: 0 });
  assert.equal(response.status, 200);
  assert.equal(Number(f.state.orders[0].handlingFee), 0);
  assert.equal(Number(f.state.orders[0].totalAmount), 1875);
  assert.equal(Number(f.state.vendorOrders[0].commissionRate), 10);
  assert.equal(Number(f.state.vendorOrders[0].commissionAmount), 180);
  assert.equal(Number(f.state.vendorOrders[0].vendorAmount), 1620);
});
test("idempotent replay retains a historical order's original total and fee", async () => {
  const f = fixture();
  f.state.orders.push({ id: "historic-order", checkoutKey: "checkout-request-123456", customerId: "customer-a", orderNumber: "OLD-001", customerName: "Ali Khan", customerPhone: payload.customerPhone, customerEmail: "owner@example.invalid", totalAmount: new Prisma.Decimal(2300), handlingFee: new Prisma.Decimal(200) });
  const response = await f.post();
  assert.equal(response.headers.get("X-Idempotent-Replay"), "true");
  const receipt = await readCheckoutReceipt(response);
  assert.equal(receipt.totalAmount, 2300);
  assert.equal(receipt.handlingFee, 200);
  assert.equal(Number(f.state.orders[0].handlingFee), 200);
  assert.equal(f.state.orders.length, 1);
});
test("coupon remains server-calculated and invalid codes do not create an order", async () => {
  const f = fixture(); assert.equal((await f.post({ ...payload, couponCode: "SAVE" })).status, 400); assert.equal(f.state.orders.length, 0);
  f.options.coupon = true; const response = await f.post({ ...payload, couponCode: "SAVE" }); assert.equal(response.status, 200); assert.equal(Number(f.state.orders[0].totalAmount), 2000); assert.equal(Number(f.state.orders[0].handlingFee), 0);
});
test("vendor-funded coupon reduces seller item payout without adding a fee", async () => {
  const f = fixture(); f.options.coupon = true; f.options.vendorFundedCoupon = true; f.owners.set("cream", "vendor-a");
  const response = await f.post({ ...payload, couponCode: "SAVE" });
  assert.equal(response.status, 200);
  assert.equal(Number(f.state.orders[0].totalAmount), 2000);
  assert.equal(Number(f.state.orders[0].handlingFee), 0);
  assert.equal(Number(f.state.vendorOrders[0].saleAmount), 1900);
  assert.equal(Number(f.state.vendorOrders[0].commissionAmount), 0);
  assert.equal(Number(f.state.vendorOrders[0].vendorAmount), 1900);
});
test("validation, session expiry, unimplemented payments and insufficient stock cannot create orders", async () => {
  for (const change of [{ customerAddress: " " }, { city: "Karachi" }, { paymentMethod: "card" }, { products: [{ productId: "cream", quantity: 99 }] }, { sameBillingAddress: false, billingAddress: {} }]) {
    const f = fixture(); assert.equal((await f.post({ ...payload, ...change })).status, 400); assert.equal(f.state.orders.length, 0);
  }
  const f = fixture(); f.options.signedIn = false; assert.equal((await f.post()).status, 401);
});
test("production's missing recipientKey rolls back the entire transaction and returns a sanitized reference", async () => {
  const f = fixture(); f.options.outboxMissing = true; const response = await f.post(); assert.equal(response.status, 503);
  assert.equal(f.state.orders.length, 0); assert.equal(f.state.jobs.length, 0); assert.equal(f.state.stocks.cream, 5);
  assert.match(response.headers.get("X-Request-ID")!, /^[a-f0-9-]+$/); assert.doesNotMatch(await response.text(), /recipientKey|SQL|secret|password/);
  assert.match(JSON.stringify(f.logs), /P2022/); assert.match(JSON.stringify(f.logs), /recipientKey/); assert.doesNotMatch(JSON.stringify(f.logs), /PRIVATE|password|owner@example/);
});
test("stock race and transaction failure roll back; preflight database errors are also sanitized JSON", async () => {
  const f = fixture(); f.options.transactionStockRace = true; assert.equal((await f.post()).status, 409); assert.equal(f.state.orders.length, 0);
  f.options.transactionStockRace = false; f.options.failAt = "transaction"; assert.equal((await f.post()).status, 503); assert.equal(f.state.orders.length, 0);
  f.options.failAt = "customer"; const response = await f.post(); assert.equal(response.status, 503); assert.equal(response.headers.get("Content-Type"), "application/json");
});
test("SMTP rejection and receipt read failure after commit cannot turn success into a failed checkout", async () => {
  const f = fixture(); f.options.smtpFails = true; f.options.failReceipt = true;
  const response = await f.post(); assert.equal(response.status, 200); const receipt = await readCheckoutReceipt(response); assert.equal(receipt.orderNumber, "IRB-001"); assert.equal(f.state.orders.length, 1); assert.equal(f.state.jobs.length, 1);
});
test("client rejects malformed or empty success without permitting cart clearing, and maps expired sessions", async () => {
  for (const body of ["", "<html>Bad gateway</html>", "{}", '{"_id":"order"}']) await assert.rejects(readCheckoutReceipt(new Response(body)), /could not confirm/);
  await assert.rejects(readCheckoutReceipt(new Response("{}", { status: 401 })), /session has expired/);
  await assert.rejects(readCheckoutReceipt(new Response('{"error":"raw SQL secret"}', { status: 500 })), error => !String(error).includes("raw SQL"));
});
test("retry keys survive reload for the same customer/cart and clear only on confirmed success", () => {
  const records = new Map<string, string>(); const storage = { getItem: (key: string) => records.get(key) || null, setItem: (key: string, value: string) => { records.set(key, value); }, removeItem: (key: string) => { records.delete(key); } };
  const key = checkoutAttemptKey("customer-a:cart", storage, () => "checkout-request-123456");
  assert.equal(checkoutAttemptKey("customer-a:cart", storage, () => { throw Error("must reuse"); }), key);
  assert.notEqual(checkoutAttemptKey("customer-b:cart", storage, () => "checkout-request-999999"), key);
  clearCheckoutAttempt(storage); assert.equal(records.size, 0);
});

for (const requestType of ["SERVICE", "GIFT"]) test(`accepted ${requestType} quote without a catalog product creates one order with agreed pricing`, async () => {
 const f = fixture(); f.options.quote = true; f.options.quoteType = requestType; f.options.productlessQuote = true; f.options.quoteShipping = requestType === "SERVICE" ? 0 : 75;
 const response = await f.post({ ...payload, quoteId: "quote-1", products: [{ productId: "quote:quote-1", quantity: 1 }] });
 assert.equal(response.status, 200, await response.text());
 assert.equal(Number(f.state.orders[0].totalAmount), 1800 + f.options.quoteShipping);
 if(requestType === "SERVICE") { assert.equal(f.state.services.length,1);assert.equal(f.state.services[0].serviceId,null);assert.equal(f.state.bundles.length,0); } else {
 assert.equal(f.state.items[0].productId, null);
 assert.equal(f.state.bundles[0].vendorId, "vendor-a");
 assert.equal(f.state.vendorOrders[0].vendorProductId, null); }
 assert.equal(f.state.stocks.cream, 5);
 assert.equal(f.state.jobs.length, 2);
 assert.equal((await f.post()).headers.get("X-Idempotent-Replay"), "true");
 assert.equal(f.state.orders.length, 1);
});

test("stale displayed prices or delivery cannot silently charge a different amount", async () => {
 for (const fields of [{expectedSubtotal: 1}, {expectedDeliveryCharge: 999}, {expectedSubtotal: -1}]) {
   const f = fixture(); const response = await f.post({...payload,...fields});
   assert.equal(response.status, 409); assert.equal(f.state.orders.length, 0);
 }
 const f = fixture(); assert.equal((await f.post({...payload,expectedSubtotal:2000,expectedDeliveryCharge:100})).status,200);
});

test("product with service add-on retains product delivery and stores separate service settlement", async () => {
 const f = fixture(); f.owners.set("cream", "vendor-a");
 const response = await f.post({...payload,products:[{productId:"cream",quantity:1,serviceId:"assembly"}],expectedSubtotal:2500,expectedDeliveryCharge:100});
 assert.equal(response.status,200,await response.text());
 assert.equal(Number(f.state.orders[0].totalAmount),2600);
 assert.equal(f.state.services.length,1);
 assert.equal(Number(f.state.services[0].price),500);
 assert.equal(Number(f.state.services[0].commissionAmount),50);
 assert.equal(Number(f.state.services[0].vendorPayable),450);
 assert.equal(f.state.stocks.cream,4);
});

test("release blocker: service quote creates a booking instead of a parcel", async () => {
 const f=fixture();f.options.quote=true;f.options.quoteType="SERVICE";f.options.productlessQuote=true;f.options.quoteShipping=0;
 const res=await f.post({...payload,quoteId:"quote-1",products:[{productId:"quote:quote-1",quantity:1}]});assert.equal(res.status,200);
 assert.equal(f.state.services.length,1);assert.equal(f.state.bundles.length,0);assert.equal(f.state.items.length,0);
});
test("release blocker: bespoke gift stores an authoritative item-to-seller reference", async () => {
 const f=fixture();f.options.quote=true;f.options.quoteType="GIFT";f.options.productlessQuote=true;
 assert.equal((await f.post({...payload,quoteId:"quote-1",products:[{productId:"quote:quote-1",quantity:1}]})).status,200);
 const seller=f.state.events.find(e=>e.eventType==="order_created")!.details.lineSellers[0];assert.equal(seller.vendorId,"vendor-a");assert.ok(seller.vendorOrderId);
});
