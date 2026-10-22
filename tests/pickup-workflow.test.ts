import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";
import { appendStatusHistory, syncLineOrdersToShopStatus } from "../lib/vendor-shop-order-helpers";

type Row = Record<string, any>;
function fixture(): Row {
  const vendor = { id: "vendor-a", shopName: "Shop A", address: "Old address", city: "Lahore", ownerName: "Owner", phone: "03001234567", onboardingData: { pickupAddress: "Verified address", pickupCity: "Lahore", pickupContactName: "Pickup person", pickupPhone: "03009999999" } };
  const shops: Row[] = ["one", "two", "other"].map((id, i) => ({ id, vendorId: i === 2 ? "vendor-b" : "vendor-a", customerId: `customer-${id}`, orderId: "parent", shopOrderNumber: `IRV-${id}`, status: "packed", statusHistory: [] }));
  const requests: Row[] = [];
  const visits: Row[] = [];
  const lines: Row[] = [];
  const audits: Row[] = [];
  const notifications: Row[] = [];
  const mailJobs: Row[] = [];
  const tx: Row = {
    vendor: { findUniqueOrThrow: async () => vendor, findUnique: async () => vendor },
    vendorShopOrder: {
      findFirst: async ({ where }: Row) => shops.find(s => s.id === where.id && s.vendorId === where.vendorId),
      findUnique: async ({ where }: Row) => shops.find(s => s.id === where.id) || null,
      updateMany: async ({ where, data }: Row) => { const row = shops.find(s => s.id === where.id && s.status === where.status); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
    },
    vendorOrder: { updateMany: async ({ where, data }: Row) => { lines.push({ ...where, ...data }); return { count: 1 }; } },
    pickupRequest: {
      findUnique: async ({ where }: Row) => requests.find(r => r.shopOrderId === where.shopOrderId) || null,
      create: async ({ data }: Row) => { const row = { ...data, visitId: null, collectedAt: null, handoverAt: null }; requests.push(row); return row; },
      findMany: async ({ where }: Row) => requests.filter(r => where.id.in.includes(r.id)).map(r => ({ ...r, shopOrder: shops.find(s => s.id === r.shopOrderId) })),
      updateMany: async ({ where, data }: Row) => { const row = requests.find(r => r.id === where.id && r.status === where.status && r.visitId === where.visitId); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
    },
    pickupVisit: {
      create: async ({ data }: Row) => { const row = { ...data }; visits.push(row); return row; },
      findUnique: async ({ where }: Row) => { const row = visits.find(v => v.id === where.id); return row ? { ...row, requests: requests.filter(r => r.visitId === row.id).map(r => ({ ...r, shopOrder: shops.find(s => s.id === r.shopOrderId) })) } : null; },
      updateMany: async ({ where, data }: Row) => { const row = visits.find(v => v.id === where.id && v.status === where.status); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
    },
    adminAuditLog: { create: async ({ data }: Row) => { audits.push(data); return data; } },
    orderConfirmationEmail: { upsert: async ({ create }: Row) => { mailJobs.push(create); return create; } },
  };
  const db = { ...tx, $transaction: async (fn: (t: Row) => Promise<unknown>) => fn(tx) };
  const modules: Row = { "node:crypto": { randomUUID }, "@/lib/prisma": { prisma: db }, "@/lib/marketplace-api": { ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message); } } }, "@/lib/vendor-shop-order-helpers": { appendStatusHistory, syncLineOrdersToShopStatus }, "@/lib/admin-rbac": { writeAdminAudit: async (client: Row, data: Row) => client.adminAuditLog.create({ data }) }, "@/lib/customer-notifications": { createCustomerNotification: async (data: Row, client: Row) => { assert.equal(client, tx); notifications.push(data); return data; } } };
  const exported: Row = {};
  const js = ts.transpileModule(readFileSync("lib/pickup-workflow.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { exports: exported, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; }, Date, Array, Error, Object, String });
  return { ...exported, shops, requests, visits, lines, audits, notifications, mailJobs };
}

test("vendor request uses saved address, rejects another vendor, and is idempotent", async () => {
  const f = fixture();
  await assert.rejects(f.requestPickup({ shopOrderId: "other", vendorId: "vendor-a", parcelCount: 1 }), /not found/i);
  const first = await f.requestPickup({ shopOrderId: "one", vendorId: "vendor-a", parcelCount: 3, weightKg: 2.5 });
  assert.equal(first.pickupAddress, "Verified address"); assert.equal(first.contactPhone, "03009999999"); assert.equal(first.parcelCount, 3);
  const duplicate = await f.requestPickup({ shopOrderId: "one", vendorId: "vendor-a", parcelCount: 99 });
  assert.equal(duplicate.pickupReference, first.pickupReference); assert.equal(f.requests.length, 1);
});

test("one visit groups only one vendor and one location; handover ships only after collection", async () => {
  const f = fixture();
  const one = await f.requestPickup({ shopOrderId: "one", vendorId: "vendor-a", parcelCount: 1 });
  const two = await f.requestPickup({ shopOrderId: "two", vendorId: "vendor-a", parcelCount: 2 });
  const other = await f.requestPickup({ shopOrderId: "other", vendorId: "vendor-b", parcelCount: 1 });
  await assert.rejects(f.schedulePickup({ requestIds: [one.id, other.id], scheduledAt: new Date(), adminId: "admin" }), /one vendor/);
  const visit = await f.schedulePickup({ requestIds: [one.id, two.id], scheduledAt: new Date(), adminId: "admin" });
  assert.equal(f.visits.length, 1); assert.equal(f.requests.filter((r: Row) => r.visitId === visit.id).length, 2);
  await assert.rejects(f.updatePickupVisit({ visitId: visit.id, adminId: "admin", action: "handover", handoverReference: "H-1", trackingNumbers: { [one.id]: "T1", [two.id]: "T2" } }), /state changed/i);
  await f.updatePickupVisit({ visitId: visit.id, adminId: "admin", action: "assign", courierName: "Courier" });
  await f.updatePickupVisit({ visitId: visit.id, adminId: "admin", action: "collect" });
  const result = await f.updatePickupVisit({ visitId: visit.id, adminId: "admin", action: "handover", handoverReference: "H-1", trackingNumbers: { [one.id]: "T1", [two.id]: "T2" } });
  assert.equal(result.shippedOrderIds.length, 2);
  assert.deepEqual(f.shops.map((s: Row) => s.status), ["shipped", "shipped", "packed"]);
  assert.deepEqual(f.lines.map((l: Row) => l.status), ["shipped", "shipped"]);
  assert.equal(f.requests.find((r: Row) => r.id === one.id).handoverReference, "H-1");
  assert.equal(f.audits.length, 4);
  assert.deepEqual(f.notifications.map((n: Row) => n.idempotencyKey).sort(), ["shop-status:one:shipped", "shop-status:two:shipped"]);
  assert.deepEqual(f.mailJobs.map((j: Row) => j.recipientKey).sort(), ["shipped:one", "shipped:two"]);
});

test("failed visits can be rescheduled; cancelled grouped orders are excluded from handover", async () => {
  const f = fixture();
  const one = await f.requestPickup({ shopOrderId: "one", vendorId: "vendor-a", parcelCount: 1 });
  const two = await f.requestPickup({ shopOrderId: "two", vendorId: "vendor-a", parcelCount: 1 });
  const visit = await f.schedulePickup({ requestIds: [one.id, two.id], scheduledAt: new Date(), adminId: "admin" });
  await f.updatePickupVisit({ visitId: visit.id, adminId: "admin", action: "fail", reason: "Courier unavailable" });
  assert.equal(f.visits[0].status, "failed");
  await f.updatePickupVisit({ visitId: visit.id, adminId: "admin", action: "reschedule", scheduledAt: new Date(Date.now() + 86400000) });
  assert.equal(f.visits[0].status, "scheduled");
  await f.updatePickupVisit({ visitId: visit.id, adminId: "admin", action: "assign", agentName: "Agent" });
  f.requests.find((r: Row) => r.id === two.id).status = "cancelled";
  f.shops.find((s: Row) => s.id === "two").status = "cancelled";
  await f.updatePickupVisit({ visitId: visit.id, adminId: "admin", action: "collect" });
  const result = await f.updatePickupVisit({ visitId: visit.id, adminId: "admin", action: "handover", handoverReference: "H-2", trackingNumbers: { [one.id]: "T1" } });
  assert.deepEqual(result.shippedOrderIds, ["one"]);
  assert.equal(f.shops.find((s: Row) => s.id === "two").status, "cancelled");
});

test("unassigned collection needs an explicit reason and evidence", async () => {
  const f = fixture();
  const request = await f.requestPickup({ shopOrderId: "one", vendorId: "vendor-a", parcelCount: 1 });
  const visit = await f.schedulePickup({ requestIds: [request.id], scheduledAt: new Date(), adminId: "admin" });
  await assert.rejects(f.updatePickupVisit({ visitId: visit.id, adminId: "admin", action: "collect" }), /assign a courier or agent/i);
  assert.equal(f.visits[0].status, "scheduled");
  await f.updatePickupVisit({ visitId: visit.id, adminId: "admin", action: "collect", reason: "Emergency replacement", exceptionEvidence: "Signed collection receipt 123" });
  assert.equal(f.visits[0].status, "collected");
  assert.match(String(f.visits[0].history.at(-1).note), /Signed collection receipt 123/);
});

test("admin legacy recovery requires a packed order and records evidence without shipping", async () => {
  const f = fixture();
  const input = { shopOrderId: "one", adminId: "admin", pickupAddress: "Verified seller warehouse", pickupCity: "Lahore", contactName: "Pickup person", contactPhone: "03001234567", parcelCount: 2, reason: "Vendor account is suspended", evidence: "Parcel photos and signed inventory sheet" };
  const pickup = await f.recoverLegacyPickup(input);
  assert.equal(pickup.status, "ready");
  assert.equal(f.shops[0].status, "packed");
  assert.equal(f.audits[0].action, "pickup.legacy.recovered");
  await assert.rejects(f.recoverLegacyPickup(input), /already exists/);
  f.shops[1].status = "cancelled";
  await assert.rejects(f.recoverLegacyPickup({ ...input, shopOrderId: "two" }), /only packed/i);
});
