import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { ApiError } from "../lib/marketplace-api";

type Vendor = { id: string; status: string; suspendedAt: Date | null; suspensionReason: string | null; suspendedBy: string | null; suspensionUntil: Date | null; suspensionCount: number };

function fixture(status = "approved") {
  const vendor: Vendor = { id: "v1", status, suspendedAt: null, suspensionReason: null, suspendedBy: null, suspensionUntil: null, suspensionCount: 0 };
  const logs: { action: string; details: Record<string, unknown> }[] = [];
  const adminLogs: Record<string, unknown>[] = [];
  const sessions = [{ vendorId: "v1", isRevoked: false }];
  let failAudit = false;
  const clone = () => JSON.parse(JSON.stringify({ vendor, logs, adminLogs, sessions }));
  const matches = (where: { id: string; status?: string; suspensionUntil?: { lte: Date } }) =>
    where.id === vendor.id && (!where.status || where.status === vendor.status) &&
    (!where.suspensionUntil || (vendor.suspensionUntil !== null && vendor.suspensionUntil.getTime() <= where.suspensionUntil.lte.getTime()));
  const tx = {
    vendor: {
      findUnique: async () => ({ ...vendor }),
      findMany: async ({ where }: { where: { suspensionUntil: { lte: Date } } }) => matches({ id: vendor.id, status: "suspended", suspensionUntil: where.suspensionUntil }) ? [{ id: vendor.id }] : [],
      updateMany: async ({ where, data }: { where: Parameters<typeof matches>[0]; data: Record<string, unknown> }) => {
        if (!matches(where)) return { count: 0 };
        const { suspensionCount, ...rest } = data as { suspensionCount?: { increment: number } };
        Object.assign(vendor, rest);
        if (suspensionCount) vendor.suspensionCount += suspensionCount.increment;
        return { count: 1 };
      },
    },
    vendorSession: { updateMany: async () => { sessions.forEach(s => { s.isRevoked = true; }); return { count: 1 }; } },
    vendorAuditLog: {
      create: async ({ data }: { data: { action: string; details: Record<string, unknown> } }) => { if (failAudit) throw new Error("audit down"); logs.unshift(data); return data; },
      findFirst: async () => logs.find(log => log.action === "admin_suspend") ?? null,
    },
    adminAuditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { adminLogs.push(data); return data; } },
    adminUser: { findUnique: async () => ({ id: "admin-1" }) },
  };
  // Like a real transaction, a failure leaves the earlier writes undone.
  const prisma = {
    ...tx,
    $transaction: async <T,>(work: (client: typeof tx) => Promise<T>) => {
      const before = clone();
      try { return await work(tx); }
      catch (error) {
        Object.assign(vendor, before.vendor, { suspensionUntil: before.vendor.suspensionUntil ? new Date(before.vendor.suspensionUntil) : null, suspendedAt: before.vendor.suspendedAt ? new Date(before.vendor.suspendedAt) : null });
        logs.splice(0, logs.length, ...before.logs); adminLogs.splice(0, adminLogs.length, ...before.adminLogs); sessions.splice(0, sessions.length, ...before.sessions);
        throw error;
      }
    },
  };
  const imports: Record<string, unknown> = {
    "@prisma/client": {}, "@/lib/prisma": { prisma }, "@/lib/marketplace-api": { ApiError },
    "@/lib/security/sanitize": { sanitizePlainText: (value: string) => value },
  };
  const output = ts.transpileModule(readFileSync(resolve("lib/vendor-suspension.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const lib: Record<string, unknown> = {};
  runInNewContext(output, { exports: lib, Date, console, require: (name: string) => { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; } });
  return { lib: lib as unknown as typeof import("../lib/vendor-suspension"), vendor, logs, adminLogs, sessions, failAudit: () => { failAudit = true; } };
}

const admin = { vendorId: "v1", adminId: "admin-1", adminEmail: "admin@example.invalid" };
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600000);

test("the admin's date is read as Pakistan time on any server, and impossible dates are refused", () => {
  const { lib } = fixture();
  assert.equal(lib.parseKarachiDateTime("2026-11-30T15:00")?.toISOString(), "2026-11-30T10:00:00.000Z");
  assert.equal(lib.parseKarachiDateTime("2027-02-31T10:00"), null);
  assert.equal(lib.parseKarachiDateTime("2026-11-30"), null);
  assert.equal(lib.parseKarachiDateTime("nonsense"), null);
  assert.equal(lib.formatKarachi(new Date("2026-11-30T10:00:00.000Z")), "30 Nov 2026, 3:00 pm PKT");
});

test("a temporary suspension stores everything together and ends sessions", async () => {
  const f = fixture();
  const result = await f.lib.suspendVendor({ ...admin, reason: "contact with admin support", type: "temporary", until: "2099-11-30T15:00" });
  assert.equal(result.type, "temporary");
  assert.equal(f.vendor.status, "suspended");
  assert.equal(f.vendor.suspensionReason, "contact with admin support");
  assert.equal(f.vendor.suspensionUntil?.toISOString(), "2099-11-30T10:00:00.000Z");
  assert.equal(f.vendor.suspensionCount, 1);
  assert.equal(f.sessions[0].isRevoked, true);
  const payload = f.logs[0].details.payload as Record<string, unknown>;
  assert.equal(payload.suspensionType, "temporary");
  assert.equal(f.logs[0].details.previousStatus, "approved");
  assert.equal(f.adminLogs.length, 1);
});

test("bad temporary input is refused with a clear message and changes nothing", async () => {
  const f = fixture();
  await assert.rejects(f.lib.suspendVendor({ ...admin, reason: "x", type: "temporary" }), /Choose the date and time/);
  await assert.rejects(f.lib.suspendVendor({ ...admin, reason: "x", type: "temporary", until: "2020-01-01T10:00" }), /must be in the future/);
  assert.equal(f.vendor.status, "approved");
  assert.equal(f.vendor.suspensionCount, 0);
  assert.equal(f.logs.length, 0);
});

test("suspending twice is refused, so the count and history stay accurate", async () => {
  const f = fixture();
  await f.lib.suspendVendor({ ...admin, reason: "first" });
  await assert.rejects(f.lib.suspendVendor({ ...admin, reason: "second" }), /already suspended/);
  assert.equal(f.vendor.suspensionCount, 1);
  assert.equal(f.logs.length, 1);
});

test("a failed audit write leaves the vendor untouched", async () => {
  const f = fixture();
  f.failAudit();
  await assert.rejects(f.lib.suspendVendor({ ...admin, reason: "x" }), /audit down/);
  assert.equal(f.vendor.status, "approved");
  assert.equal(f.vendor.suspensionCount, 0);
  assert.equal(f.sessions[0].isRevoked, false);
});

test("an expired temporary suspension reactivates once and keeps its history", async () => {
  const f = fixture();
  await f.lib.suspendVendor({ ...admin, reason: "short", type: "temporary", until: "2099-01-01T10:00" });
  assert.equal(await f.lib.reactivateIfExpired("v1"), false, "not expired yet");
  assert.equal(f.vendor.status, "suspended");
  f.vendor.suspensionUntil = hoursAgo(1);
  assert.equal(await f.lib.reactivateExpiredSuspensions(), 1);
  assert.equal(f.vendor.status, "approved");
  assert.equal(f.vendor.suspensionUntil, null);
  assert.equal(f.vendor.suspensionCount, 1, "count is history, not current state");
  assert.ok(f.logs.some(log => log.action === "admin_suspend"));
  assert.equal(f.logs[0].action, "suspension_expired");
  assert.equal(await f.lib.reactivateExpiredSuspensions(), 0);
});

test("a permanent suspension never reactivates by itself, only by an admin", async () => {
  const f = fixture();
  const result = await f.lib.suspendVendor({ ...admin, reason: "fraud", type: "permanent" });
  assert.equal(result.until, null);
  assert.equal(await f.lib.reactivateIfExpired("v1", new Date("2999-01-01T00:00:00Z")), false);
  assert.equal(await f.lib.reactivateExpiredSuspensions(new Date("2999-01-01T00:00:00Z")), 0);
  assert.equal(f.vendor.status, "suspended");
  assert.equal((await f.lib.unsuspendVendor(admin)).status, "approved");
  assert.equal(f.vendor.suspensionCount, 1);
  await assert.rejects(f.lib.unsuspendVendor(admin), /not suspended/);
});

test("lifting a suspension restores the earlier status instead of approving an unreviewed seller", async () => {
  for (const status of ["pending", "onboarding", "rejected"]) {
    const f = fixture(status);
    await f.lib.suspendVendor({ ...admin, reason: "review" });
    assert.equal((await f.lib.unsuspendVendor(admin)).status, status);
    assert.equal(f.vendor.status, status);
  }
  const expired = fixture("pending");
  await expired.lib.suspendVendor({ ...admin, reason: "x", type: "temporary", until: "2099-01-01T10:00" });
  expired.vendor.suspensionUntil = hoursAgo(1);
  await expired.lib.reactivateExpiredSuspensions();
  assert.equal(expired.vendor.status, "pending");
});

test("older suspensions without a recorded status still reactivate as approved sellers", async () => {
  const f = fixture("suspended");
  f.logs.push({ action: "admin_suspend", details: { payload: { action: "suspend" } } });
  assert.equal((await f.lib.unsuspendVendor(admin)).status, "approved");
});
