/** Isolated MySQL replay and real route/service tests. Never connects to the configured application database. */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { PrismaClient, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import ts from "typescript";
import { parse } from "dotenv";

const requireLocal = createRequire(import.meta.url);
const databaseName = `joro_checkout_test_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
const config = parse(fs.readFileSync(".env"));
const source = new URL(process.env.JORO_LOCAL_TEST_ADMIN_URL || config.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "Only a local MySQL server may run this suite.");
assert.match(databaseName, /^joro_checkout_test_\d+_[a-f0-9]{8}$/);
const systemUrl = new URL(source); systemUrl.pathname = "/mysql";
const testUrl = new URL(source); testUrl.pathname = `/${databaseName}`;
const system = new PrismaClient({ datasourceUrl: systemUrl.toString() });
let db!: PrismaClient;
let created = false;
let shared: PrismaClient | undefined;
let checks = 0;
const pass = (label: string) => { checks++; console.log(`PASS DB ${checks}: ${label}`); };
const cli = (args: string[]) => {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], { env: { ...process.env, DATABASE_URL: testUrl.toString(), NODE_ENV: "test" }, encoding: "utf8" });
  // Never echo command/environment/connection strings if a tool fails.
  assert.equal(result.status, 0, `Isolated Prisma command failed: ${args.slice(0, 2).join(" ")}`);
  return result.stdout;
};

async function main() {
  await system.$executeRawUnsafe(`CREATE DATABASE \`${databaseName}\``);
  created = true;
  Object.assign(process.env, { DATABASE_URL: testUrl.toString(), NODE_ENV: "test" });
  cli(["migrate", "deploy"]);
  cli(["migrate", "diff", "--from-url", testUrl.toString(), "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"]);
  db = new PrismaClient({ datasourceUrl: testUrl.toString() });
  shared = (await import("../lib/prisma")).prisma;
  pass("all migrations replay into a newly created disposable database; resulting schema matches Prisma");

  const marketplace = await import("../lib/marketplace-api");
  const quoteService = await import("../lib/offer-checkout-service");
  const addonService = await import("../lib/service-checkout-service");
  const serializer = await import("../lib/serialize");
  const includes = await import("../lib/prisma-order-includes");
  const addresses = await import("../lib/checkout-addresses");
  const preference = await import("../lib/checkout-address-preference");
  const addressService = await import("../lib/customer-address-service");
  const addressSchema = await import("../lib/customer-address-schema");
  const diagnostics = await import("../lib/checkout-diagnostics");
  const handling = await import("../lib/handling-fee");
  const coupons = await import("../lib/coupon-service");
  const commissions = await import("../lib/vendor-commission");
  const catalog = await import("../lib/catalog-product-select");
  const confirmations = await import("../lib/order-confirmation-delivery");
  const fulfillment = await import("../lib/service-quote-fulfillment");
  const seller = await import("../lib/order-line-seller");
  const afterSales = await import("../lib/after-sales");
  const refunds = await import("../lib/refund-service");
  const earnings = await import("../lib/vendor-earning-service");
  const fixturePassword = "isolated-fixture-unusable-password";
  const a = await db.customer.create({ data: { id: "customer-a", name: "Checkout Test A", email: "a@example.invalid", passwordHash: fixturePassword, phone: "03001234567" } });
  const b = await db.customer.create({ data: { id: "customer-b", name: "Checkout Test B", email: "b@example.invalid", passwordHash: fixturePassword } });
  const vendor = await db.vendor.create({ data: { shopName: "Isolated Provider", ownerName: "Fixture", email: "v@example.invalid", passwordHash: fixturePassword, address: "Fixture provider location", status: "approved", specialCommissionRate: 10 } });
  const otherVendor = await db.vendor.create({ data: { shopName: "Other Provider", ownerName: "Fixture", email: "v2@example.invalid", passwordHash: fixturePassword, address: "Fixture", status: "approved" } });
  const product = await db.product.create({ data: { id: "cream", name: "Fixture product", description: "Isolated test", price: 2000, stock: 50, variants: [], category: "Home" } });
  await db.vendorProduct.create({ data: { vendorId: vendor.id, productName: product.name, description: "Fixture", price: product.price, stock: 50, category: "Home", images: [], status: "active", publishedProductId: product.id } });
  const service = await db.serviceOffering.create({ data: { vendorId: vendor.id, name: "Assembly", description: "Fixture", type: "Installation", price: 500, cities: ["Lahore"], durationMinutes: 30, leadDays: 1, warranty: "", cancellationTerms: "Review required" } });
  await db.productServiceAddon.create({ data: { productId: product.id, serviceId: service.id } });
  let customer = a, providerId = vendor.id;
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse }, "node:crypto": { randomUUID }, "@prisma/client": { Prisma }, zod: requireLocal("zod"),
    "@/lib/prisma": { prisma: db }, "@/lib/marketplace-api": { ...marketplace, sameOrigin: () => {}, customerActor: async () => ({ id: customer.id, name: customer.name, email: customer.email }), adminActor: async () => "test-admin" },
    "@/lib/sessions": { getAdminSession: async () => ({ user: { role: "admin" } }), getCustomerSession: async () => ({ user: { id: customer.id, role: "customer", email: customer.email } }) },
    "@/lib/customer-api-auth": { requireCustomerApi: async () => ({ customer }) },
    "@/lib/vendor-auth-server": { getVendorFromSession: async () => ({ vendor: { id: providerId, status: "approved" } }) },
    "@/lib/admin-rbac": { requireAdminPermission: async () => ({ admin: { id: "isolated-admin" } }) }, "@/lib/auto-cancel-orders": {}, "@/lib/settings-db": { getOrCreateSettings: async () => ({ codAvailableCities: ["Lahore"], codCharges: 100 }) },
    "@/lib/order-number": { generateOrderNumber: async () => `TEST-${randomUUID()}` },
    "@/lib/catalog-product-select": catalog, "@/lib/prisma-order-includes": includes,
    "@/lib/order-emails": { notifyAdminNewOrder: async () => {} }, "@/lib/order-confirmation-delivery": confirmations,
    "@/lib/vendor-notifications": { createVendorNotification: async () => {} }, "@/lib/serialize": serializer,
    "@/lib/vendor-commission": commissions, "@/lib/handling-fee": handling, "@/lib/coupon-service": coupons,
    "@/lib/vendor-shop-order-number": { generateVendorShopOrderNumber: async () => `SHOP-${randomUUID()}` },
    "@/lib/marketplace-prisma": { getMarketplacePrisma: () => db, getMarketplaceTx: (tx: unknown) => tx },
    "@/lib/offer-checkout-service": quoteService, "@/lib/service-checkout-service": addonService,
    "@/lib/checkout-addresses": addresses, "@/lib/checkout-diagnostics": diagnostics,
    "@/lib/customer-address-schema": addressSchema, "@/lib/customer-address-service": addressService,
    "@/lib/checkout-address-preference": preference, "@/lib/service-quote-fulfillment": fulfillment,
    "@/lib/customer-service-policy": await import("../lib/customer-service-policy"),
    "@/lib/order-line-seller": seller, "@/lib/after-sales": afterSales,
    "@/lib/find-order": await import("../lib/find-order"), "@/lib/order-state": await import("../lib/order-state"),
    "@/lib/order-cancellation-service": await import("../lib/order-cancellation-service"), "@/lib/order-inventory-service": await import("../lib/order-inventory-service"),
    "@/lib/order-ownership": await import("../lib/order-ownership"), "@/lib/order-tracking-timeline": await import("../lib/order-tracking-timeline"),
    "@/lib/customer-notifications": await import("../lib/customer-notifications"),
    "@/lib/vendor-api-auth": { requireApprovedVendorApi: async () => ({ vendor: { id: providerId } }) },
  };
  Object.assign(modules["@/lib/order-emails"] as object, { notifyCustomerShipped: async () => {}, notifyCustomerPaymentRejected: async () => {}, notifyCustomerOrderCancelled: async () => {} });
  type Route = Record<string, (...args: any[]) => Promise<Response>>; // eslint-disable-line @typescript-eslint/no-explicit-any -- Route adapters exercise real handlers.
  function route(file: string): Route {
    const output = {};
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(js, { exports: output, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; }, console, Error, Date, URL });
    return output;
  }
  const orders = route("app/api/orders/route.ts"), addressApi = route("app/api/customer/addresses/route.ts"), bookings = route("app/api/services/bookings/route.ts"), returns = route("app/api/customer/returns/route.ts");
  const orderAdmin = route("app/api/orders/[id]/route.ts"), vendorReturns = route("app/api/vendor/returns/route.ts"), vendorReturnActions = route("app/api/vendor/returns/[id]/route.ts");
  const request = (url: string, body: unknown, key = randomUUID()) => new Request(`http://localhost${url}`, { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) });
  const payload = { customerName: "Saved Recipient", customerPhone: "+923001234567", customerAddress: "12 Fixture Street, Apartment 2", city: "Lahore", postalCode: "54000", sameBillingAddress: false, billingAddress: { name: "Billing Recipient", address: "Independent billing street", city: "Karachi" }, paymentMethod: "cod", products: [{ productId: product.id, quantity: 1 }], expectedSubtotal: 2000, expectedDeliveryCharge: 100 };
  async function quote(type: string, linked = false) {
    const want = await db.want.create({ data: { customerId: a.id, title: `${type} fixture requirement`, category: "Home", requestType: type, city: "Lahore", quantity: 2, status: "OPEN", expiresAt: new Date(Date.now() + 86400000) } });
    const offer = await db.wantOffer.create({ data: { wantId: want.id, vendorId: vendor.id, status: "ACCEPTED", revisions: { create: { revisionNumber: 1, initiator: "VENDOR", productId: linked ? product.id : null, price: 900, quantity: 2, shipping: type === "SERVICE" ? 0 : 75, delivery: "Agreed completion", condition: "Any", warranty: "Agreed warranty", message: "Fixture scope", expiresAt: want.expiresAt } } }, include: { revisions: true } });
    return db.offerQuote.create({ data: { wantId: want.id, customerId: a.id, revisionId: offer.revisions[0].id, snapshot: {}, idempotencyKey: randomUUID(), expiresAt: want.expiresAt } });
  }
  const serviceQuote = await quote("SERVICE");
  const servicePayload = { ...payload, quoteId: serviceQuote.id, products: [{ productId: `quote:${serviceQuote.id}`, quantity: 2 }], expectedSubtotal: 1800, expectedDeliveryCharge: 0 };
  const concurrent = await Promise.all([orders.POST(request("/api/orders", servicePayload)), orders.POST(request("/api/orders", servicePayload))]);
  assert.ok(concurrent.some(r => r.status === 200));
  const persistedQuote = await db.offerQuote.findUniqueOrThrow({ where: { id: serviceQuote.id } }); assert.ok(persistedQuote.orderId);
  const serviceOrder = await db.order.findUniqueOrThrow({ where: { id: persistedQuote.orderId }, include: { services: true, vendorShopOrders: true, orderItems: true } });
  assert.equal(serviceOrder.services.length, 1); assert.equal(serviceOrder.vendorShopOrders.length, 0); assert.equal(serviceOrder.orderItems.length, 0); assert.equal(Number(serviceOrder.totalAmount), 1800);
  assert.equal((await orders.POST(request("/api/orders", servicePayload))).status, 200);
  assert.equal(await db.order.count(), 1); assert.equal(await db.orderService.count(), 1);
  assert.equal(await db.orderService.count({ where: { orderId: serviceOrder.id } }), 1);
  pass("concurrent quote checkout/retry creates one real service booking and no parcel, duplicate order or fake catalog reference");
  const job = serviceOrder.services[0];
  const change = (status: string, role = "vendor", extra = {}) => bookings.PATCH(request("/api/services/bookings", { id: job.id, role, status, note: "Isolated verification evidence", ...extra }));
  providerId = otherVendor.id; assert.equal((await change("CONFIRMED")).status, 404); providerId = vendor.id;
  assert.equal((await change("CONFIRMED")).status, 200);
  assert.equal((await change("SCHEDULED", "vendor", { scheduledAt: new Date(Date.now() + 86400000).toISOString() })).status, 200);
  assert.equal((await change("IN_PROGRESS")).status, 200);
  assert.equal((await change("COMPLETED")).status, 200);
  assert.equal((await change("COMPLETED")).status, 200);
  assert.equal(await db.vendorEarning.count({ where: { orderServiceId: job.id } }), 0);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: serviceOrder.id } })).paymentStatus, "pending");
  // Exercise the actual authorized receipt API with isolated evidence; no cash or gateway transfer occurs.
  assert.equal((await orderAdmin.PUT(request("/api/orders/x", { paymentStatus: "received" }), { params: { id: serviceOrder.id } })).status, 400);
  assert.equal((await orderAdmin.PUT(request("/api/orders/x", { paymentStatus: "received", notes: "ISOLATED receipt evidence; no real payment" }), { params: { id: serviceOrder.id } })).status, 200);
  await db.$transaction(tx => fulfillment.settleCompletedQuoteServices(tx, serviceOrder.id));
  assert.equal(await db.vendorEarning.count({ where: { orderServiceId: job.id } }), 1);
  assert.equal(await db.vendorLedgerEntry.count({ where: { vendorId: vendor.id, type: "earning_credit" } }), 1);
  pass("authorized service scheduling/completion needs no courier; pending receipt prevents earnings, verified test receipt settles once");
  const productResponse = await orders.POST(request("/api/orders", payload)); assert.equal(productResponse.status, 200);
  const productReceipt = await productResponse.json(); assert.equal(productReceipt.totalAmount, 2100);
  const mixed = await orders.POST(request("/api/orders", { ...payload, expectedSubtotal: 2500, products: [{ productId: product.id, quantity: 1, serviceId: service.id }] })); assert.equal(mixed.status, 200);
  const mixedReceipt = await mixed.json(); assert.equal(mixedReceipt.totalAmount, 2600);
  const mixedOrder = await db.order.findUniqueOrThrow({ where: { id: mixedReceipt._id }, include: { vendorShopOrders: true, services: true } });
  assert.equal(mixedOrder.vendorShopOrders.length, 1); assert.equal(mixedOrder.services[0].serviceId, service.id);
  const ship = await import("../lib/vendor-shop-order-service");
  await db.vendorShopOrder.update({ where: { id: mixedOrder.vendorShopOrders[0].id }, data: { status: "packed" } });
  assert.match((await ship.advanceVendorShopOrderStatus({ shopOrderId: mixedOrder.vendorShopOrders[0].id, actor: "admin" }) as { error: string }).error, /courier handover/);
  pass("product total/delivery and mixed add-on pricing/stock remain intact; physical orders still require courier workflow");

  const gift = await quote("GIFT"), giftPayload = { ...payload, quoteId: gift.id, products: [{ productId: `quote:${gift.id}`, quantity: 2 }], expectedSubtotal: 1800, expectedDeliveryCharge: 75 };
  const giftResponse = await orders.POST(request("/api/orders", giftPayload)); assert.equal(giftResponse.status, 200); const giftReceipt = await giftResponse.json(); assert.equal(giftReceipt.totalAmount, 1875);
  const giftOrder = await db.order.findUniqueOrThrow({ where: { id: giftReceipt._id }, include: { orderItems: true, vendorShopOrders: true } });
  assert.equal(await db.orderInventoryLine.count({ where: { orderId: giftOrder.id } }), 0);
  // Historical delivered fixture for return testing; no courier handover is fabricated.
  await db.order.update({ where: { id: giftOrder.id }, data: { paymentStatus: "received", orderStatus: "delivered" } });
  await db.vendorShopOrder.update({ where: { id: giftOrder.vendorShopOrders[0].id }, data: { paymentStatus: "received", status: "delivered" } });
  await earnings.createVendorEarningForDeliveredShopOrder(giftOrder.vendorShopOrders[0].id);
  customer = b; assert.equal((await returns.POST(request("/api/customer/returns", { orderItemId: giftOrder.orderItems[0].id, quantity: 1, reason: "Fixture return" }))).status, 404); customer = a;
  const returned = await returns.POST(request("/api/customer/returns", { orderItemId: giftOrder.orderItems[0].id, quantity: 1, reason: "Fixture return", vendorId: otherVendor.id })); assert.equal(returned.status, 201);
  const returnRow = await db.returnRequest.findFirstOrThrow({ where: { orderItemId: giftOrder.orderItems[0].id } }); assert.equal(returnRow.vendorId, vendor.id);
  assert.ok(await db.vendorNotification.findFirst({ where: { vendorId: vendor.id, type: "return_requested" } }));
  providerId = otherVendor.id;
  assert.deepEqual((await (await vendorReturns.GET()).json()).returns, []);
  assert.notEqual((await vendorReturnActions.PATCH(request("/api/vendor/returns/x", { action: "approve" }), { params: { id: returnRow.id } })).status, 200);
  providerId = vendor.id;
  assert.equal((await (await vendorReturns.GET()).json()).returns.length, 1);
  assert.equal((await vendorReturnActions.PATCH(request("/api/vendor/returns/x", { action: "approve" }), { params: { id: returnRow.id } })).status, 200);
  await db.returnRequest.update({ where: { id: returnRow.id }, data: { status: "return_in_transit" } });
  assert.equal((await vendorReturnActions.PATCH(request("/api/vendor/returns/x", { action: "received" }), { params: { id: returnRow.id } })).status, 200);
  const refund = await refunds.createPendingRefund({ returnRequestId: returnRow.id, amount: 900, adminId: "isolated-admin" });
  assert.equal(refund.vendorId, vendor.id);
  await db.refund.update({ where: { id: refund.id }, data: { vendorId: null } });
  await assert.rejects(refunds.processManualRefund({ refundId: refund.id, externalRef: "ISOLATED-NO-TRANSFER", adminId: "isolated-admin", restock: false }), /attribution/);
  await db.refund.update({ where: { id: refund.id }, data: { vendorId: vendor.id } });
  await refunds.processManualRefund({ refundId: refund.id, externalRef: "ISOLATED-NO-TRANSFER", adminId: "isolated-admin", restock: false });
  await refunds.processManualRefund({ refundId: refund.id, externalRef: "ISOLATED-NO-TRANSFER", adminId: "isolated-admin", restock: false });
  const debit = await db.vendorLedgerEntry.findUniqueOrThrow({ where: { idempotencyKey: `refund:${refund.id}` } }); assert.equal(debit.vendorId, vendor.id); assert.equal(Number(debit.amount), -810);
  pass("real bespoke gift return retains seller, ignores supplied vendor ID, notifies seller; simulated manual refund debits correct net once and refuses missing attribution");
  const linked = await quote("GIFT", true); const stockBefore = (await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock;
  assert.equal((await orders.POST(request("/api/orders", { ...giftPayload, quoteId: linked.id, products: [{ productId: product.id, quantity: 2 }] }))).status, 200);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, stockBefore - 2);
  pass("catalog-linked gifts keep inventory deductions and negotiated pricing");
  const secondProduct = await db.product.create({ data: { name: "Other seller product", description: "Fixture", price: 300, stock: 5, variants: [], category: "Home" } });
  await db.vendorProduct.create({ data: { vendorId: otherVendor.id, productName: secondProduct.name, description: "Fixture", price: 300, stock: 5, category: "Home", images: [], status: "active", publishedProductId: secondProduct.id } });
  const multiResponse = await orders.POST(request("/api/orders", { ...payload, products: [{ productId: product.id, quantity: 1 }, { productId: secondProduct.id, quantity: 1 }], expectedSubtotal: 2300 })); assert.equal(multiResponse.status, 200);
  const multiReceipt = await multiResponse.json();
  const multi = await db.order.findUniqueOrThrow({ where: { id: multiReceipt._id }, include: { orderItems: true, vendorShopOrders: true } });
  const sellerA = multi.vendorShopOrders.find(s => s.vendorId === vendor.id)!;
  await db.vendorShopOrder.update({ where: { id: sellerA.id }, data: { status: "delivered" } });
  const itemA = multi.orderItems.find(i => i.productId === product.id)!, itemB = multi.orderItems.find(i => i.productId === secondProduct.id)!;
  assert.equal((await returns.POST(request("/api/customer/returns", { orderItemId: itemA.id, quantity: 1, reason: "Fixture multivendor return" }))).status, 201);
  assert.equal((await returns.POST(request("/api/customer/returns", { orderItemId: itemB.id, quantity: 1, reason: "Fixture undelivered return" }))).status, 409);
  const multiReturn = await db.returnRequest.findFirstOrThrow({ where: { orderItemId: itemA.id } }); assert.equal(multiReturn.vendorId, vendor.id);
  providerId = otherVendor.id;
  assert.notEqual((await vendorReturnActions.PATCH(request("/api/vendor/returns/x", { action: "approve" }), { params: { id: multiReturn.id } })).status, 200); providerId = vendor.id;
  pass("multi-vendor returns use the delivered seller slice and another seller cannot see or approve the return");
  const cancelledQuote = await quote("SERVICE");
  const cancelResponse = await orders.POST(request("/api/orders", { ...servicePayload, quoteId: cancelledQuote.id, products: [{ productId: `quote:${cancelledQuote.id}`, quantity: 2 }] })); assert.equal(cancelResponse.status, 200);
  const cancelReceipt = await cancelResponse.json();
  const cancellation = await import("../lib/order-cancellation-service");
  assert.equal((await cancellation.cancelParentOrder({ orderId: cancelReceipt._id, reason: "Isolated cancellation review", customerId: a.id, actorId: a.id, actorType: "customer" })).ok, true);
  const cancelledBooking = await db.orderService.findFirstOrThrow({ where: { orderId: cancelReceipt._id } }); assert.equal(cancelledBooking.status, "CANCELLED");
  assert.equal((await bookings.PATCH(request("/api/services/bookings", { id: cancelledBooking.id, role: "vendor", status: "CONFIRMED", note: "Attempt after cancellation" }))).status, 409);
  assert.equal(await db.vendorEarning.count({ where: { orderServiceId: cancelledBooking.id } }), 0);
  pass("whole-order cancellation closes its standalone booking and prevents later provider completion or earnings");
  await addressApi.POST(request("/api/customer/addresses", { label: "Home", recipientName: "Existing Recipient", phone: "+923001234567", address: "Existing saved street", city: "Lahore", isDefault: true }));
  assert.equal((await addressApi.POST(request("/api/customer/addresses", { orderId: productReceipt._id }))).status, 200);
  assert.equal((await addressApi.POST(request("/api/customer/addresses", { orderId: productReceipt._id }))).status, 200);
  const fresh = new PrismaClient({ datasourceUrl: testUrl.toString() });
  try { const rows = await fresh.customerAddress.findMany({ where: { customerId: a.id } }); assert.equal(rows.length, 1); assert.equal(rows[0].address, payload.customerAddress); assert.equal(rows[0].postalCode, "54000"); } finally { await fresh.$disconnect(); }
  customer = b; assert.deepEqual((await (await addressApi.GET()).json()).addresses, []); assert.equal((await addressApi.POST(request("/api/customer/addresses", { orderId: productReceipt._id }))).status, 404); customer = a;
  const createdEvent = await db.orderStatusEvent.findFirstOrThrow({ where: { orderId: productReceipt._id, eventType: "order_created" } });
  assert.equal((createdEvent.details as { addresses: { billing: { address: string } } }).addresses.billing.address, "Independent billing street");
  const beforeAddress = await db.customerAddress.findFirstOrThrow({ where: { customerId: a.id } });
  assert.equal((await orders.POST(request("/api/orders", { ...payload, customerAddress: "One time unsaved street" }))).status, 200);
  assert.equal((await db.customerAddress.findFirstOrThrow({ where: { customerId: a.id } })).address, beforeAddress.address);
  pass("address save persists across real clients, updates rather than duplicates, isolates customers, preserves independent billing and unchecked checkout");
  const uiQuote = await quote("SERVICE");
  const uiOrderResponse = await orders.POST(request("/api/orders", { ...servicePayload, quoteId: uiQuote.id, products: [{ productId: `quote:${uiQuote.id}`, quantity: 2 }] })); assert.equal(uiOrderResponse.status, 200);
  const uiOrder = await uiOrderResponse.json();

  // Bridge real isolated APIs into the existing React browser harness.
  const server = http.createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const url = req.url || "/"; const body = Buffer.concat(chunks).toString();
      const web = new Request(`http://localhost${url}`, { method: req.method, headers: { "content-type": "application/json", "Idempotency-Key": String(req.headers["idempotency-key"] || randomUUID()) }, ...(req.method !== "GET" ? { body } : {}) });
      let response: Response;
      if (url.startsWith("/api/customer/addresses")) response = req.method === "GET" ? await addressApi.GET() : await addressApi.POST(web);
      else if (url.startsWith("/api/orders")) response = await orders.POST(web);
      else if (url.startsWith("/api/services/bookings")) response = req.method === "GET" ? await bookings.GET(web) : await bookings.PATCH(web);
      else if (url.startsWith("/api/customer/profile")) response = Response.json({ name: a.name, email: a.email, phone: a.phone });
      else if (url.startsWith("/api/settings")) response = Response.json({ codAvailableCities: ["Lahore"], codCharges: 100 });
      else response = Response.json({ handlingFee: 0 });
      res.writeHead(response.status, { "content-type": "application/json" }); res.end(await response.text());
    } catch { res.writeHead(500); res.end('{"error":"Isolated bridge failed"}'); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const browser = await import("./test-checkout-db-browser.mjs");
    await browser.runDatabaseCheckoutBrowser(`http://127.0.0.1:${address.port}`);
    assert.equal((await db.customerAddress.findFirstOrThrow({ where: { customerId: a.id } })).address, "Browser persisted delivery street");
    pass("real checkout React UI autofills from MySQL, saves checked address after real isolated checkout, reloads it and preserves unchecked default");
    const uiBooking = await db.orderService.findFirstOrThrow({ where: { orderId: uiOrder._id } });
    assert.equal(uiBooking.status, "COMPLETED"); assert.equal((await db.order.findUniqueOrThrow({ where: { id: uiOrder._id } })).paymentStatus, "pending");
    assert.equal(await db.vendorEarning.count({ where: { orderServiceId: uiBooking.id } }), 0);
    pass("provider React UI reviews actual agreed details, schedules and completes the real test booking without courier or invented receipt");
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  console.log(`Disposable database verification complete: ${checks} groups passed. No external email, payment, refund transfer or courier integration called.`);
}

main().catch(error => { console.error("Isolated database verification failed:", error instanceof assert.AssertionError ? error.message : error?.code || error?.name || "Unknown"); process.exitCode = 1; }).finally(async () => {
  if (db) await db.$disconnect();
  if (shared) await shared.$disconnect();
  if (created) { assert.match(databaseName, /^joro_checkout_test_\d+_[a-f0-9]{8}$/); await system.$executeRawUnsafe(`DROP DATABASE \`${databaseName}\``); console.log("Removed only the newly created disposable database."); }
  await system.$disconnect();
});
