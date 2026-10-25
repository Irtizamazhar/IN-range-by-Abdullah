import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { advanceQuoteService, settleCompletedQuoteServices } from "../lib/service-quote-fulfillment";
import { resolveOrderLineSeller } from "../lib/order-line-seller";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Small mutable Prisma fixtures; real transaction coverage lives in test:checkout:db.
type Row = Record<string, any>;

function bookingFixture() {
  const order = { id: "order", customerId: "customer-a", orderStatus: "confirmed", paymentStatus: "pending", updatedAt: new Date(), offerQuote: { id: "quote", revision: { offer: { vendorId: "provider-a" } } } };
  const job: Row = { id: "booking", orderId: order.id, vendorId: "provider-a", serviceId: null, productId: null, status: "IN_PROGRESS", snapshot: { kind: "ACCEPTED_SERVICE_QUOTE", quoteId: "quote" }, updatedAt: new Date(), price: new Prisma.Decimal(900), quantity: 2, commissionRate: new Prisma.Decimal(10), commissionAmount: new Prisma.Decimal(180), vendorPayable: new Prisma.Decimal(1620), order };
  const earnings = new Map<string, Row>(), ledger = new Map<string, Row>(), events: Row[] = [];
  const db = {
    order: { findUnique: async () => order, updateMany: async () => ({ count: 1 }), update: async ({ data }: Row) => Object.assign(order, data) },
    orderService: { findUnique: async () => job, findMany: async () => job.status === "COMPLETED" ? [job] : [], updateMany: async ({ data }: Row) => { Object.assign(job, data); return { count: 1 }; } },
    serviceEvent: { create: async ({ data }: Row) => { events.push(data); return data; } }, orderStatusEvent: { create: async () => ({}) }, customerNotification: { create: async () => ({}) },
    vendorEarning: { upsert: async ({ where, create }: Row) => { if (!earnings.has(where.orderServiceId)) earnings.set(where.orderServiceId, { id: "earning", ...create }); return earnings.get(where.orderServiceId); } },
    vendorLedgerEntry: { upsert: async ({ where, create }: Row) => { if (!ledger.has(where.idempotencyKey)) ledger.set(where.idempotencyKey, create); return ledger.get(where.idempotencyKey); } },
  };
  return { tx: db as unknown as Prisma.TransactionClient, order, job, earnings, ledger, events };
}

test("service completion needs no courier and cannot collect payment or duplicate settlement", async () => {
  const f = bookingFixture();
  const input = { role: "vendor" as const, status: "COMPLETED", note: "Service completion evidence" };
  await advanceQuoteService(f.tx, "booking", input, "vendor:provider-a", "provider-a");
  assert.equal(f.job.status, "COMPLETED"); assert.equal(f.order.orderStatus, "delivered");
  assert.equal(f.order.paymentStatus, "pending"); assert.equal(f.earnings.size, 0); assert.equal(f.ledger.size, 0);
  await advanceQuoteService(f.tx, "booking", input, "vendor:provider-a", "provider-a"); assert.equal(f.events.length, 1);
  f.order.paymentStatus = "received";
  await settleCompletedQuoteServices(f.tx, "order"); await settleCompletedQuoteServices(f.tx, "order");
  assert.equal(f.earnings.size, 1); assert.equal(f.ledger.size, 1); assert.equal(Number(f.ledger.get("earning:earning")?.amount), 1620);
});

test("another provider/customer cannot complete a booking; cancelled or unscheduled services cannot advance", async () => {
  const f = bookingFixture(), input = { role: "vendor" as const, status: "COMPLETED", note: "Evidence" };
  await assert.rejects(advanceQuoteService(f.tx, "booking", input, "vendor:other", "other"), /Booking not found/);
  await assert.rejects(advanceQuoteService(f.tx, "booking", { ...input, role: "customer" }, "customer:customer-a", undefined, "customer-a"), /Customers may request scheduling/);
  f.job.status = "PENDING";
  await assert.rejects(advanceQuoteService(f.tx, "booking", input, "vendor:provider-a", "provider-a"), /Invalid service status transition/);
  f.order.orderStatus = "cancelled";
  await assert.rejects(advanceQuoteService(f.tx, "booking", input, "vendor:provider-a", "provider-a"), /cancelled/);
  assert.equal(f.events.length, 0); assert.equal(f.earnings.size, 0);
});

test("receipt alone cannot settle unfinished service; corrupted provider attribution fails safely", async () => {
  const f = bookingFixture(); f.order.paymentStatus = "received";
  await settleCompletedQuoteServices(f.tx, "order"); assert.equal(f.earnings.size, 0);
  f.job.status = "COMPLETED"; f.job.vendorId = "other";
  await assert.rejects(settleCompletedQuoteServices(f.tx, "order"), /attribution/);
  assert.equal(f.earnings.size, 0);
});

function sellerFixture() {
  const evidence: Row[] = ["a", "b"].map(id => ({ orderItemId: `item-${id}`, vendorId: `vendor-${id}`, vendorOrderId: `line-${id}`, vendorShopOrderId: `shop-${id}` }));
  const lines = evidence.map(e => ({ id: e.vendorOrderId, vendorId: e.vendorId, vendorShopOrderId: e.vendorShopOrderId, orderId: "order", quantity: 2, saleAmount: new Prisma.Decimal(1800), vendorAmount: new Prisma.Decimal(1620) }));
  const order = { orderItems: [{ id: "item-a" }, { id: "item-b" }], statusEvents: [{ details: { lineSellers: evidence } }], offerQuote: null };
  const db = {
    orderItem: { findUnique: async ({ where }: Row) => ({ id: where.id, orderId: "order", quantity: 2, price: new Prisma.Decimal(900), order }) },
    vendorOrder: { findMany: async ({ where }: Row) => lines.filter(l => l.orderId === where.orderId && l.vendorId === where.vendorId && (!where.id || l.id === where.id)) },
    vendorShopOrder: { findFirst: async ({ where }: Row) => ({ id: where.id, vendorId: where.vendorId, status: "delivered" }) },
  };
  return { tx: db as unknown as Prisma.TransactionClient, evidence, order };
}

test("bespoke gift seller identity follows the exact committed line in multi-vendor orders", async () => {
  const f = sellerFixture();
  assert.equal((await resolveOrderLineSeller(f.tx, "item-a"))?.vendorId, "vendor-a");
  assert.equal((await resolveOrderLineSeller(f.tx, "item-b"))?.vendorId, "vendor-b");
  f.evidence[0].vendorId = "vendor-b";
  await assert.rejects(resolveOrderLineSeller(f.tx, "item-a"), /administrative review/);
});

test("unknown or ambiguous gift sellers cannot silently become platform-funded refunds", async () => {
  const f = sellerFixture(); f.evidence.length = 0;
  await assert.rejects(resolveOrderLineSeller(f.tx, "item-a"), /administrative review/);
  const ambiguous = sellerFixture(); ambiguous.evidence.push({ ...ambiguous.evidence[0] });
  await assert.rejects(resolveOrderLineSeller(ambiguous.tx, "item-a"), /administrative review/);
});
