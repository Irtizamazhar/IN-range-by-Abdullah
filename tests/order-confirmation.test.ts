import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma, PrismaClient } from "@prisma/client";
import { orderConfirmationEligible, confirmationRetry } from "../lib/order-confirmation-policy";
import { deliverOrderConfirmation, queueOrderConfirmation } from "../lib/order-confirmation-delivery";
import { orderConfirmationEmail, vendorOrderEmail } from "../lib/joro-email-templates";
import { POST } from "../app/api/cron/order-confirmations/route";
import { decideGatedRequest } from "../lib/private-launch/gate-policy";
import nodemailer from "nodemailer";
import { JORO_SENDER, sendMail, sendMailOutcome } from "../lib/mailer";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { paymentMethodLabel, serializeVendorShopOrder } from "../lib/vendor-shop-order-helpers";
import { api, ApiError } from "../lib/marketplace-api";

const order = { id: "order-123", orderNumber: "JORO-123", orderStatus: "confirmed", paymentMethod: "cod", paymentStatus: "pending", customerName: "Ali <script>", customerEmail: "checkout-untrusted@example.invalid", customerAddress: "12 <b>Street</b>", city: "Lahore", createdAt: new Date("2026-10-15T12:00:00Z"), totalAmount: 2500, customer: { email: "owner@example.invalid", isActive: true }, orderItems: [{ name: "Shirt <img src=x>", quantity: 2, price: 1000 }] };

test("only confirmed COD or received bank-transfer payments are eligible", () => {
  assert.equal(orderConfirmationEligible(order), true);
  for (const orderStatus of ["pending", "cancelled"]) assert.equal(orderConfirmationEligible({ ...order, orderStatus }), false);
  for (const paymentStatus of ["failed", "rejected", "refunded", "submitted"]) assert.equal(orderConfirmationEligible({ ...order, paymentStatus }), false);
  for (const paymentStatus of ["pending", "submitted", "failed", "rejected"]) assert.equal(orderConfirmationEligible({ ...order, paymentMethod: "bank_transfer", paymentStatus }), false);
  assert.equal(orderConfirmationEligible({ ...order, paymentMethod: "bank_transfer", paymentStatus: "received" }), true);
  assert.equal(orderConfirmationEligible({ ...order, paymentMethod: "card", paymentStatus: "received" }), false);
});

test("transactional enqueue uses the order's unique key and cannot reset delivered jobs", async () => {
  const calls: unknown[] = [];
  const tx = { vendorShopOrder: { findMany: async () => [] }, orderConfirmationEmail: { upsert: async (args: unknown) => calls.push(args) } } as unknown as Prisma.TransactionClient;
  await queueOrderConfirmation(tx, { ...order, orderStatus: "pending" });
  assert.equal(calls.length, 0);
  await queueOrderConfirmation(tx, order);
  await queueOrderConfirmation(tx, order);
  assert.deepEqual(calls, Array(2).fill({ where: { orderId_recipientKey: { orderId: order.id, recipientKey: "customer" } }, create: { orderId: order.id, recipientKey: "customer" }, update: {} }));
});

const shop = { id: "shop-a", orderId: order.id, placedAt: order.createdAt, status: "pending", totalAmount: 1900, customerName: "Ali", customerPhone: "03001234567", customerAddress: "12 Street", city: "Lahore", vendor: { email: "seller-a@example.invalid", shopName: "Store A", ownerName: "Owner A", status: "approved" }, items: [{ productName: "Shirt", quantity: 2, price: 1000, subtotal: 1900, image: "https://joro.pk/shirt.png" }] };

function fixture(initialAttempts = 0, value: typeof order | null = order, bundle: (typeof shop & { pickupRequest?: { status: string; trackingNumber: string }; trackingNumber?: string; shopOrderNumber?: string }) | null = shop) {
  const job = { id: "job-1", orderId: order.id, recipientKey: "customer", status: "pending", attempts: initialAttempts, availableAt: new Date(0), claimedAt: null as Date | null, acceptedAt: null as Date | null, lastError: null as string | null };
  const db = { orderConfirmationEmail: {
    findFirst: async () => job.status === "pending" && job.attempts < 5 && job.availableAt <= new Date() ? { ...job } : null,
    updateMany: async ({ where, data }: { where: { id?: string; status: string; attempts?: number; availableAt?: { lte: Date }; claimedAt?: { lt: Date } }; data: { status: string; claimedAt?: Date; attempts?: { increment: number } } }) => {
      if (where.id ? job.status !== where.status : job.status !== "sending" || !job.claimedAt || job.claimedAt >= where.claimedAt!.lt) return { count: 0 };
      if (where.id && (job.attempts !== where.attempts || job.availableAt > where.availableAt!.lte)) return { count: 0 };
      job.status = data.status;
      if (data.claimedAt) job.claimedAt = data.claimedAt;
      if (data.attempts) job.attempts += data.attempts.increment;
      return { count: 1 };
    },
    update: async ({ data }: { data: Partial<typeof job> }) => Object.assign(job, data),
  }, order: { findUnique: async () => value }, vendorShopOrder: { findFirst: async ({ where }: { where: { id: string; orderId: string } }) => bundle?.id === where.id && bundle.orderId === where.orderId ? bundle : null } };
  return { job, db: db as unknown as PrismaClient };
}

test("concurrent workers send once, only to the persisted owner; SMTP acceptance is recorded", async () => {
  const { job, db } = fixture();
  const recipients: string[] = [];
  await Promise.all(Array.from({ length: 4 }, () => deliverOrderConfirmation(db, async opts => { recipients.push(opts.to); return "accepted"; })));
  assert.deepEqual(recipients, ["owner@example.invalid"]);
  assert.equal(job.status, "accepted");
  assert.ok(job.acceptedAt);
  await deliverOrderConfirmation(db, async () => { assert.fail("Accepted mail must not send twice"); });
});

test("definite SMTP failures retry with backoff and never mark acceptance", async () => {
  const { job, db } = fixture();
  await deliverOrderConfirmation(db, async () => "retry");
  assert.equal(job.status, "pending");
  assert.equal(job.attempts, 1);
  assert.equal(job.acceptedAt, null);
  assert.ok(job.availableAt > new Date());
  job.availableAt = new Date(0);
  await deliverOrderConfirmation(db, async () => "accepted");
  assert.equal(job.status, "accepted");
  const exhausted = fixture(4);
  await deliverOrderConfirmation(exhausted.db, async () => "retry");
  assert.equal(exhausted.job.status, "failed");
  assert.equal(confirmationRetry(50, new Date(0)).getTime(), 60 * 60_000);
});

test("pickup shipment mail retries from the committed job and uses synchronized tracking", async () => {
  const bundle = { ...shop, status: "shipped", trackingNumber: "TRACK-1", shopOrderNumber: "IRV-1", pickupRequest: { status: "handed_over", trackingNumber: "TRACK-1" } };
  const { db, job } = fixture(0, order, bundle);
  job.recipientKey = "shipped:shop-a";
  await deliverOrderConfirmation(db, async () => "retry");
  assert.equal(job.status, "pending");
  job.availableAt = new Date(0);
  const messages: string[] = [];
  await deliverOrderConfirmation(db, async message => { messages.push(`${message.to} ${message.text}`); return "accepted"; });
  assert.equal(job.status, "accepted");
  assert.equal(messages.length, 1);
  assert.match(messages[0], /owner@example.invalid[\s\S]*TRACK-1/);
  assert.doesNotMatch(messages[0], /checkout-untrusted/);

  const stale = fixture(0, order, { ...bundle, pickupRequest: { status: "handed_over", trackingNumber: "OLD" } });
  stale.job.recipientKey = "shipped:shop-a";
  await deliverOrderConfirmation(stale.db, async () => { assert.fail("Conflicting tracking must not be mailed"); });
  assert.equal(stale.job.status, "skipped");
});

test("ambiguous SMTP errors and interrupted workers are held to prevent duplicate retries", async () => {
  for (const send of [async () => "uncertain" as const, async (): Promise<never> => { throw new Error("timeout"); }]) {
    const { job, db } = fixture();
    await deliverOrderConfirmation(db, send);
    assert.equal(job.status, "uncertain");
    assert.equal(job.acceptedAt, null);
    await deliverOrderConfirmation(db, async () => { assert.fail("Uncertain mail must not auto-retry"); });
  }
  const { job, db } = fixture();
  job.status = "sending"; job.claimedAt = new Date(0);
  await deliverOrderConfirmation(db, async () => { assert.fail("Interrupted send must not auto-retry"); });
  assert.equal(job.status, "uncertain");
});

test("deleted owners, cancelled orders and unconfirmed payments cannot send", async () => {
  for (const value of [null, { ...order, orderStatus: "cancelled" }, { ...order, customer: { ...order.customer, isActive: false } }, { ...order, paymentMethod: "bank_transfer", paymentStatus: "submitted" }]) {
    const { job, db } = fixture(0, value);
    await deliverOrderConfirmation(db, async () => { assert.fail("Ineligible order must not send"); });
    assert.equal(job.status, "skipped");
  }
});

test("template escapes all untrusted content, shows actual PKR payment and secure order link", () => {
  const email = orderConfirmationEmail(order);
  assert.match(email.html, /https:\/\/joro\.pk\/logo\.png/);
  assert.doesNotMatch(email.html, /<script>|<b>Street|<img src=x>/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.text, /PKR 2,500.00/);
  assert.match(email.text, /pending \(due on delivery\)/);
  assert.match(email.html, /\/account\/orders\/order-123/);
  assert.doesNotMatch(email.html, /checkout-untrusted/);
});

test("customer receipt includes exact subject, snapshots, delivery, discount and no invented arrival date", () => {
  const email = orderConfirmationEmail({ ...order, totalAmount: 2600, couponRedemption: { discount: 100 }, services: [{ price: 200, quantity: 1 }], orderItems: [{ ...order.orderItems[0], image: "https://joro.pk/shirt.png" }] });
  assert.equal(email.subject, "JORO | Order Confirmed - #JORO-123");
  for (const text of ["Subtotal: PKR 2,000.00", "Delivery Charges: PKR 500.00", "Discount: PKR 100.00", "Booked services: PKR 200.00", "Final Order Total: PKR 2,600.00", "Track Your Order", "JORO Support"]) assert.ok(email.text.includes(text), text);
  assert.match(email.html, /src="https:\/\/joro.pk\/shirt.png"/);
  assert.doesNotMatch(email.text, /Estimated Delivery|paid|bankAccount|commission/i);
  assert.match(email.html, /name="viewport"/);
  assert.match(email.html, /max-width:600px/);
});

test("each vendor gets only its own snapshot and amount, never parent totals or other sellers", () => {
  const second = { ...shop, id: "shop-b", totalAmount: 750, vendor: { ...shop.vendor, shopName: "Store B" }, items: [{ productName: "Private B product", quantity: 3, price: 250, subtotal: 750, image: "javascript:alert(1)" }] };
  const parent = { ...order, totalAmount: 98765, customerEmail: "unrelated@example.invalid" };
  const a = vendorOrderEmail(parent, shop), b = vendorOrderEmail(parent, second);
  assert.equal(a.subject, "JORO | New Order Received - #JORO-123");
  assert.match(a.text, /Shirt x 2 - PKR 1,000.00 each; PKR 1,900.00/);
  assert.match(a.text, /Your items amount: PKR 1,900.00/);
  assert.match(b.text, /Private B product x 3 - PKR 250.00 each; PKR 750.00/);
  assert.doesNotMatch(a.text + a.html, /Private B product|Store B|98,765|unrelated@example|commission|netAmount/);
  assert.doesNotMatch(b.text + b.html, /Shirt|Store A|javascript:/);
  assert.match(a.html, /\/vendor\/dashboard\/orders\/shop-a/);
  assert.match(b.html, /\/vendor\/dashboard\/orders\/shop-b/);
  assert.match(a.text, /pending \(due on delivery\)/);
  assert.match(vendorOrderEmail({ ...parent, paymentMethod: "bank_transfer", paymentStatus: "received" }, shop).text, /Payment status: received/);
});

test("customer receipt separates the committed handling fee from delivery charges", () => {
  const current = orderConfirmationEmail({ ...order, totalAmount: 2450, handlingFee: 50, couponRedemption: { discount: 100 } });
  for (const line of ["Subtotal: PKR 2,000.00", "Discount: PKR 100.00", "Handling Fee: PKR 50.00", "Delivery Charges: PKR 500.00", "Final Order Total: PKR 2,450.00"]) assert.ok(current.text.includes(line), line);
  assert.ok(current.text.indexOf("Discount:") < current.text.indexOf("Handling Fee:"));
  const email = orderConfirmationEmail({ ...order, totalAmount: 2650, handlingFee: 150, couponRedemption: { discount: 100 }, services: [{ price: 200, quantity: 1 }] });
  assert.match(email.text, /Delivery Charges: PKR 400.00/);
  assert.match(email.text, /Handling Fee: PKR 150.00/);
  assert.match(email.text, /Final Order Total: PKR 2,650.00/);
  assert.doesNotMatch(email.text, /Delivery Charges: PKR 550.00/);
  const freeDelivery = orderConfirmationEmail({ ...order, totalAmount: 2150, handlingFee: 150 });
  assert.doesNotMatch(freeDelivery.text, /Delivery Charges:/);
  assert.match(freeDelivery.text, /Handling Fee: PKR 150.00/);
});

test("transactional enqueue creates separate stable customer and vendor jobs on repeated events", async () => {
  const calls: unknown[] = [];
  const tx = { vendorShopOrder: { findMany: async (args: unknown) => { assert.deepEqual(args, { where: { orderId: order.id }, select: { id: true } }); return [{ id: "shop-a" }, { id: "shop-b" }]; } }, orderConfirmationEmail: { upsert: async (args: unknown) => calls.push(args) } } as unknown as Prisma.TransactionClient;
  for (let i = 0; i < 2; i++) await queueOrderConfirmation(tx, order);
  assert.deepEqual(calls.slice(0, 3), calls.slice(3));
  assert.deepEqual(calls.slice(0, 3), ["customer", "vendor:shop-a", "vendor:shop-b"].map(recipientKey => ({ where: { orderId_recipientKey: { orderId: order.id, recipientKey } }, create: { orderId: order.id, recipientKey }, update: {} })));
});

test("vendor worker uses bundle ownership, one message for multiple products, and atomic delivery claims", async () => {
  const bundle = { ...shop, items: [...shop.items, { ...shop.items[0], productName: "Second own item" }] };
  const { db, job } = fixture(0, order, bundle); job.recipientKey = "vendor:shop-a";
  const messages: { to: string; text?: string; messageId?: string }[] = [];
  await Promise.all(Array.from({ length: 4 }, () => deliverOrderConfirmation(db, async message => { messages.push(message); return "accepted"; })));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, shop.vendor.email);
  assert.match(messages[0].text!, /Second own item/);
  assert.equal(messages[0].messageId, "<joro-order-confirmation-job-1@joro.pk>");
  assert.equal(job.status, "accepted");
  await deliverOrderConfirmation(db, async () => { assert.fail("No duplicate vendor message"); });
});

test("missing recipients, removed/mismatched bundles, suspended sellers and cancelled bundles never send", async () => {
  for (const bundle of [null, { ...shop, orderId: "another-order" }, { ...shop, status: "cancelled" }, { ...shop, vendor: { ...shop.vendor, status: "suspended" } }, { ...shop, vendor: { ...shop.vendor, email: "" } }]) {
    const { db, job } = fixture(0, order, bundle); job.recipientKey = "vendor:shop-a";
    await deliverOrderConfirmation(db, async () => { assert.fail("Ineligible vendor"); });
    assert.equal(job.status, "skipped");
  }
  for (const email of ["", "bad-address", "a@example.invalid\r\nBcc:other@example.invalid"]) {
    const { db, job } = fixture(0, { ...order, customer: { ...order.customer, email } });
    await deliverOrderConfirmation(db, async () => { assert.fail("Invalid customer email"); });
    assert.equal(job.status, "skipped");
  }
});

test("vendor retries use the same identifier and ambiguous SMTP outcomes are held", async () => {
  const { db, job } = fixture(); job.recipientKey = "vendor:shop-a";
  const ids: (string | undefined)[] = [];
  await deliverOrderConfirmation(db, async message => { ids.push(message.messageId); return "retry"; });
  assert.equal(job.status, "pending"); assert.equal(job.acceptedAt, null);
  job.availableAt = new Date(0);
  await deliverOrderConfirmation(db, async message => { ids.push(message.messageId); return "uncertain"; });
  assert.equal(job.status, "uncertain"); assert.deepEqual(ids, [ids[0], ids[0]]);
  await deliverOrderConfirmation(db, async () => { assert.fail("Uncertain vendor mail cannot auto-retry"); });
});

test("linked vendor order API enforces ownership and exposes only its own label items and totals", async () => {
  let vendor: string | null = "vendor-a";
  const own = { ...shop, vendorId: "vendor-a", shopOrderNumber: "SHOP-A", paymentMethod: "cod", paymentStatus: "pending", commissionAmount: 100, netAmount: 1800, updatedAt: order.createdAt, statusHistory: [], order: { orderNumber: order.orderNumber, totalAmount: 98765, handlingFee: 456, orderItems: [{ name: "SECRET OTHER VENDOR", quantity: 1, price: 98765 }] } };
  const imports: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/vendor-api-auth": { requireVendorSessionApi: async () => vendor ? { vendor: { id: vendor } } : { response: NextResponse.json({}, { status: 401 }) } },
    "@/lib/prisma": { prisma: { vendorShopOrder: { findFirst: async ({ where, include }: { where: { id: string; vendorId: string }; include: { order: { select: Record<string, boolean> } } }) => {
      assert.deepEqual(Object.keys(include.order.select), ["orderNumber"]);
      return where.id === own.id && where.vendorId === own.vendorId ? own : null;
    } } } },
    "@/lib/vendor-shop-order-helpers": { paymentMethodLabel, serializeVendorShopOrder },
  };
  const exported = {} as { GET: (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response> };
  runInNewContext(ts.transpileModule(readFileSync("app/api/orders/vendor/[id]/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exported, require: (name: string) => { assert.ok(name in imports); return imports[name]; } });
  const request = () => exported.GET(new Request("https://joro.pk/api/orders/vendor/shop-a"), { params: Promise.resolve({ id: "shop-a" }) });
  const response = await request(); assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.order.totalAmount, "1900");
  assert.deepEqual(body.order.labelItems.map((item: { name: string }) => item.name), ["Shirt"]);
  assert.doesNotMatch(JSON.stringify(body), /SECRET OTHER VENDOR|98765|checkoutTotalAmount|handlingFee|deliveryCharge/);
  vendor = "vendor-b"; assert.equal((await request()).status, 404);
  vendor = null; assert.equal((await request()).status, 401);
});

test("linked customer order API rejects another owner and requires customer authentication", async () => {
  let owner: string | null = "customer-a";
  const imports: Record<string, unknown> = {
    "@/lib/marketplace-api": { api, ApiError, customerActor: async () => { if (!owner) throw new ApiError(401, "Unauthorized"); return { id: owner }; } },
    "@/lib/customer-account-policy": { canCustomerCancelOrder: () => false },
    "@/lib/order-track-status": { resolveCustomerOrderTrackStatus: () => "confirmed" },
    "@/lib/prisma": { prisma: { order: { findFirst: async ({ where }: { where: { id: string; customerId: string } }) => where.id === order.id && where.customerId === "customer-a" ? { ...order, services: [], vendorShopOrders: [] } : null } } },
  };
  const exported = {} as { GET: (request: Request, ctx: { params: { id: string } }) => Promise<Response> };
  runInNewContext(ts.transpileModule(readFileSync("app/api/customer/orders/[id]/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exported, require: (name: string) => { assert.ok(name in imports); return imports[name]; } });
  const request = () => exported.GET(new Request("https://joro.pk/api/customer/orders/order-123"), { params: { id: order.id } });
  assert.equal((await request()).status, 200);
  owner = "customer-b"; assert.equal((await request()).status, 404);
  owner = null; assert.equal((await request()).status, 401);
});

test("cron rejects missing, invalid and Unicode credentials and remains accessible through launch gate", async () => {
  const previous = process.env.ORDER_EMAIL_CRON_SECRET;
  process.env.ORDER_EMAIL_CRON_SECRET = "test-secret";
  try {
    for (const token of ["", "Bearer incorrect", "Bearer ééééééééééé"]) {
      const response = await POST(new Request("https://joro.pk/api/cron/order-confirmations", { method: "POST", headers: { authorization: token } }));
      assert.equal(response.status, 401);
    }
    assert.equal(decideGatedRequest({ pathname: "/api/cron/order-confirmations", method: "POST" }), "allow");
    assert.equal(decideGatedRequest({ pathname: "/api/cron/order-confirmations", method: "GET" }), "block");
  } finally { if (previous === undefined) delete process.env.ORDER_EMAIL_CRON_SECRET; else process.env.ORDER_EMAIL_CRON_SECRET = previous; }
});

test("SMTP acceptance, rejection and uncertain DATA timeouts are distinguished by the real mailer", async t => {
  const keys = ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS", "SMTP_SECURE"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { EMAIL_HOST: "smtp.example.invalid", EMAIL_PORT: "465", EMAIL_USER: "test@example.invalid", EMAIL_PASS: "test-only", SMTP_SECURE: "true" });
  let reply: { accepted: string[] } | Error = { accepted: ["owner@example.invalid"] };
  const envelope: Record<string, unknown>[] = [];
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async (opts: Record<string, unknown>) => { envelope.push(opts); if (reply instanceof Error) throw reply; return reply; } }) as unknown as ReturnType<typeof nodemailer.createTransport>);
  const message = { to: "owner@example.invalid", subject: "Order confirmed", html: "<p>Order</p>", messageId: "<stable-test@joro.pk>" };
  try {
    assert.equal(await sendMailOutcome(message), "accepted");
    assert.equal(envelope[0].from, JORO_SENDER);
    assert.equal(envelope[0].messageId, message.messageId);
    reply = { accepted: [] };
    assert.equal(await sendMailOutcome(message), "retry");
    for (const error of [Object.assign(new Error("connect"), { command: "CONN" }), Object.assign(new Error("rejected"), { command: "DATA", responseCode: 451 })]) {
      reply = error;
      assert.equal(await sendMailOutcome(message), "retry");
    }
    reply = Object.assign(new Error("timeout after DATA"), { command: "DATA" });
    assert.equal(await sendMailOutcome(message), "uncertain");
    assert.equal(await sendMail(message), false);
  } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
