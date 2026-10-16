import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma, PrismaClient } from "@prisma/client";
import { orderConfirmationEligible, confirmationRetry } from "../lib/order-confirmation-policy";
import { deliverOrderConfirmation, queueOrderConfirmation } from "../lib/order-confirmation-delivery";
import { orderConfirmationEmail } from "../lib/joro-email-templates";
import { POST } from "../app/api/cron/order-confirmations/route";
import { decideGatedRequest } from "../lib/private-launch/gate-policy";
import nodemailer from "nodemailer";
import { JORO_SENDER, sendMail, sendMailOutcome } from "../lib/mailer";

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
  const tx = { orderConfirmationEmail: { upsert: async (args: unknown) => calls.push(args) } } as unknown as Prisma.TransactionClient;
  await queueOrderConfirmation(tx, { ...order, orderStatus: "pending" });
  assert.equal(calls.length, 0);
  await queueOrderConfirmation(tx, order);
  await queueOrderConfirmation(tx, order);
  assert.deepEqual(calls, Array(2).fill({ where: { orderId: order.id }, create: { orderId: order.id }, update: {} }));
});

function fixture(initialAttempts = 0, value: typeof order | null = order) {
  const job = { id: "job-1", orderId: order.id, status: "pending", attempts: initialAttempts, availableAt: new Date(0), claimedAt: null as Date | null, acceptedAt: null as Date | null, lastError: null as string | null };
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
  }, order: { findUnique: async () => value } };
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
