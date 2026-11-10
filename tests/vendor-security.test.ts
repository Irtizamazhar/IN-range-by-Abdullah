import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { approvalReadiness, OVERRIDE_REASON_MIN } from "../lib/vendor-approval";
import { writePrivateFile } from "../lib/private-storage";
import * as bankSecurity from "../lib/vendor-bank-security";
import * as personName from "../lib/validation/person-name";
import * as bank from "../lib/validation/bank";
import { sanitizePlainText } from "../lib/security/sanitize";
import { ApiError, sameOrigin } from "../lib/marketplace-api";

const repo = process.cwd();
const storageDir = mkdtempSync(path.join(tmpdir(), "joro-approval-"));
process.env.PRIVATE_STORAGE_DIR = storageDir;
test.after(() => rmSync(storageDir, { recursive: true, force: true }));

const baseVendor = {
  status: "pending", ownerName: "Ahmed Raza Khan", phone: "0300-1234567", shopName: "Raza Store", address: "12 Mall Road", city: "Lahore",
  cnic: "35202-1234567-1", businessType: "individual", businessRegNo: null, bankName: "HBL", accountTitle: "Ahmed Raza Khan", accountNumber: "12345678901", iban: null,
};

async function approvalDb(options: { vendor?: Partial<typeof baseVendor>; docs?: string[]; writeFiles?: boolean } = {}) {
  const vendorId = `vendor-${Math.random().toString(36).slice(2, 8)}`;
  const types = options.docs ?? ["cnic_front", "cnic_back"];
  const documents: Array<{ id: string; documentType: string; fileUrl: string; uploadedAt: Date }> = [];
  for (let index = 0; index < types.length; index++) {
    const type = types[index];
    const fileUrl = `vendor-docs/${vendorId}/${type}-${index}.jpg`;
    if (options.writeFiles !== false) await writePrivateFile(fileUrl, Buffer.from(type));
    documents.push({ id: `${type}-doc`, documentType: type, fileUrl, uploadedAt: new Date() });
  }
  const db = { vendor: { findUnique: async () => ({ ...baseVendor, ...options.vendor, documents }) } };
  return { vendorId, db: db as unknown as Parameters<typeof approvalReadiness>[1] };
}

test("approval: a complete application with both CNIC images can be approved without override", async () => {
  const { vendorId, db } = await approvalDb();
  const result = await approvalReadiness(vendorId, db);
  assert.deepEqual([result?.canApprove, result?.blockers, result?.reviewItems, result?.titleMatchesName], [true, [], [], true]);
});

test("approval: missing documents, missing files and invalid data block approval", async () => {
  const missingBack = await approvalReadiness(...Object.values(await approvalDb({ docs: ["cnic_front"] })) as [string, never]);
  assert.ok(missingBack?.blockers.some(item => /cnic back/.test(item)));
  const lostFiles = await approvalReadiness(...Object.values(await approvalDb({ writeFiles: false })) as [string, never]);
  assert.ok(lostFiles?.blockers.some(item => /missing from storage/.test(item)));
  const badData = await approvalReadiness(...Object.values(await approvalDb({ vendor: { cnic: "00000-0000000-0", accountNumber: "abc" } })) as [string, never]);
  assert.ok(badData?.blockers.some(item => /CNIC number/.test(item)) && badData.blockers.some(item => /Bank/.test(item)));
  const company = await approvalReadiness(...Object.values(await approvalDb({ vendor: { businessType: "company" } })) as [string, never]);
  assert.ok(company?.blockers.some(item => /registration number/.test(item)) && company.blockers.some(item => /license/.test(item)));
});

test("approval: an account title that differs from the CNIC name needs a documented manual review", async () => {
  const title = await approvalReadiness(...Object.values(await approvalDb({ vendor: { accountTitle: "Bilal Traders" } })) as [string, never]);
  assert.equal(title?.canApprove, true);
  assert.equal(title?.titleMatchesName, false);
  assert.ok(title?.reviewItems.some(item => /account title/.test(item)));
});

test("approval: suspended, rejected and onboarding sellers cannot be approved directly", async () => {
  for (const [status, pattern] of [["suspended", /suspension page/], ["rejected", /resubmit/], ["onboarding", /submitted/], ["approved", /waiting for review/]] as const) {
    const result = await approvalReadiness(...Object.values(await approvalDb({ vendor: { status } })) as [string, never]);
    assert.equal(result?.canApprove, false, status);
    assert.ok(result?.blockers.some(item => pattern.test(item)), status);
  }
});

// ---- admin approval API (route loaded with stubbed dependencies) ---------------------------------
function adminRoute(readiness: Awaited<ReturnType<typeof approvalReadiness>>, vendor: Record<string, unknown>, options: { authorized?: boolean } = {}) {
  const calls = { updateMany: [] as unknown[], update: [] as unknown[], audit: [] as unknown[], emails: 0, notifications: 0 };
  const imports: Record<string, unknown> = {
    "next/server": { NextResponse }, zod: { z }, "@prisma/client": { Prisma },
    "@/lib/admin-rbac": {
      requireAdminPermission: async () => (options.authorized === false ? { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } : { admin: { id: "admin-7", email: "ops@joro.pk" } }),
      writeAdminAudit: async (_db: unknown, data: unknown) => { calls.audit.push(data); },
    },
    "@/lib/prisma": { prisma: {
      vendor: { findUnique: async () => vendor, updateMany: async (args: { where: { status: string } }) => { calls.updateMany.push(args); return { count: vendor.status === args.where.status ? 1 : 0 }; }, update: async (args: unknown) => { calls.update.push(args); return {}; } },
      vendorAuditLog: { create: async (args: unknown) => { calls.audit.push(args); return {}; } },
    } },
    "@/lib/security/sanitize": { sanitizePlainText },
    "@/lib/vendor-mail": { sendVendorApprovedEmail: async () => { calls.emails++; }, sendVendorRejectedEmail: async () => {} },
    "@/lib/store-slug": { generateUniqueStoreSlug: async () => "raza-store" },
    "@/lib/marketplace-api": { ApiError, sameOrigin: () => {} },
    "@/lib/vendor-deletion": { deleteVendorAccount: async () => {} },
    "@/lib/vendor-suspension": { suspendVendor: async () => ({}), unsuspendVendor: async () => ({}) },
    "@/lib/vendor-approval": { approvalReadiness: async () => readiness, OVERRIDE_REASON_MIN },
    "@/lib/vendor-bank-security": bankSecurity,
    "@/lib/validation/person-name": personName,
    "@/lib/validation/bank": bank,
    "@/lib/vendor-notifications": { createVendorNotification: async () => { calls.notifications++; } },
  };
  const output = ts.transpileModule(readFileSync(path.join(repo, "app/api/admin/vendors/[id]/route.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported: { PATCH?: (req: Request, ctx: { params: { id: string } }) => Promise<Response> } = {};
  runInNewContext(output, { exports: exported, console, JSON, Date, require: (name: string) => { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; } });
  const patch = (body: unknown) => exported.PATCH!(new Request("https://joro.pk/api/admin/vendors/v1", { method: "PATCH", body: JSON.stringify(body) }), { params: { id: "v1" } });
  return { patch, calls };
}

const vendorRow = { id: "v1", email: "seller@example.pk", shopName: "Raza Store", status: "pending", storeSlug: null, bankName: "HBL", accountTitle: "Ahmed Raza Khan", accountNumber: "12345678901", iban: null,
  bankVerificationStatus: null, verifiedBankName: null, verifiedAccountTitle: null, verifiedAccountNumber: null, verifiedIban: null };
const ready = { canApprove: true, blockers: [], reviewItems: [], titleMatchesName: true };

test("admin approve API: requires review confirmation; records admin and verified bank; never marks email verified", async () => {
  const route = adminRoute(ready, vendorRow);
  assert.equal((await route.patch({ action: "approve" })).status, 400, "direct request without reviewConfirmed");
  const response = await route.patch({ action: "approve", reviewConfirmed: true });
  assert.equal(response.status, 200);
  const data = (route.calls.updateMany[0] as { data: Record<string, unknown>; where: Record<string, unknown> });
  assert.deepEqual(JSON.parse(JSON.stringify(data.where)), { id: "v1", status: "pending" });
  assert.equal(data.data.status, "approved");
  assert.equal(data.data.approvedBy, "admin-7");
  assert.ok(data.data.approvedAt instanceof Date);
  assert.equal(data.data.verifiedAccountNumber, "12345678901");
  assert.equal(data.data.bankVerificationStatus, "verified");
  assert.equal("isEmailVerified" in data.data, false);
  assert.ok(!JSON.stringify(route.calls.audit).includes("12345678901"), "audit masks the account number");
  assert.equal(route.calls.emails, 1);
});

test("admin approve API: blockers refuse; manual review needs an override reason; unauthorised admins refused", async () => {
  const blocked = adminRoute({ ...ready, canApprove: false, blockers: ["The CNIC number on the uploaded card does not match the entered CNIC."] }, vendorRow);
  const refused = await blocked.patch({ action: "approve", reviewConfirmed: true, overrideReason: "I checked everything manually today." });
  assert.equal(refused.status, 409);
  assert.equal(blocked.calls.updateMany.length, 0);

  const manual = adminRoute({ ...ready, titleMatchesName: false, reviewItems: ["Bank account title does not match the CNIC name."] }, vendorRow);
  assert.equal((await manual.patch({ action: "approve", reviewConfirmed: true })).status, 409);
  assert.equal((await manual.patch({ action: "approve", reviewConfirmed: true, overrideReason: "too short" })).status, 409);
  assert.equal((await manual.patch({ action: "approve", reviewConfirmed: true, overrideReason: "Compared both CNIC images by eye: number and name match." })).status, 200);
  assert.ok(JSON.stringify(manual.calls.audit).includes("Compared both CNIC images"), "override reason is audited");

  const forbidden = adminRoute(ready, vendorRow, { authorized: false });
  assert.equal((await forbidden.patch({ action: "approve", reviewConfirmed: true })).status, 403);
});

test("admin bank verification: only a pending change can be verified or rejected; rejection restores verified details", async () => {
  const approvedPending = { ...vendorRow, status: "approved", bankVerificationStatus: "pending_review", accountNumber: "99998888777", verifiedBankName: "HBL", verifiedAccountTitle: "Ahmed Raza Khan", verifiedAccountNumber: "12345678901", verifiedIban: null };
  const verify = adminRoute(ready, approvedPending);
  assert.equal((await verify.patch({ action: "verify_bank" })).status, 200);
  assert.equal((verify.calls.update[0] as { data: Record<string, unknown> }).data.verifiedAccountNumber, "99998888777");
  assert.equal(verify.calls.notifications, 1);

  const reject = adminRoute(ready, approvedPending);
  assert.equal((await reject.patch({ action: "reject_bank_change", reason: "Title does not match CNIC" })).status, 200);
  assert.equal((reject.calls.update[0] as { data: Record<string, unknown> }).data.accountNumber, "12345678901");

  const nothingPending = adminRoute(ready, { ...approvedPending, bankVerificationStatus: "verified" });
  assert.equal((await nothingPending.patch({ action: "verify_bank" })).status, 409);
});

// ---- bank change rules and withdrawals -----------------------------------------------------------
const approved = { status: "approved", bankName: "HBL", accountTitle: "Ahmed Raza Khan", accountNumber: "12345678901", iban: null,
  bankVerificationStatus: null as "verified" | "pending_review" | null, verifiedBankName: null, verifiedAccountTitle: null, verifiedAccountNumber: null, verifiedIban: null };

test("bank change after approval goes to review; withdrawals keep using the verified account", () => {
  assert.deepEqual(bankSecurity.payoutBankDetails(approved), { bankName: "HBL", accountTitle: "Ahmed Raza Khan", accountNumber: "12345678901", iban: null }, "legacy approved details");
  const next = { bankName: "Meezan Bank", accountTitle: "Ahmed Raza Khan", accountNumber: "55556666777", iban: null };
  const update = bankSecurity.bankChangeUpdate(approved, next) as Record<string, unknown>;
  assert.equal(update.bankVerificationStatus, "pending_review");
  assert.equal(update.verifiedAccountNumber, "12345678901", "pre-change legacy details become the verified snapshot");
  const after = { ...approved, ...next, bankVerificationStatus: "pending_review" as const, verifiedBankName: "HBL", verifiedAccountTitle: "Ahmed Raza Khan", verifiedAccountNumber: "12345678901" };
  assert.equal(bankSecurity.payoutBankDetails(after)?.accountNumber, "12345678901", "unverified change never receives payouts");
  const revert = bankSecurity.bankChangeUpdate(after, { bankName: "HBL", accountTitle: "Ahmed Raza Khan", accountNumber: "12345678901", iban: null }) as Record<string, unknown>;
  assert.equal(revert.bankVerificationStatus, "verified", "changing back to the verified account needs no review");
  assert.equal(bankSecurity.payoutBankDetails({ ...approved, status: "pending" }), null, "no payouts before approval");
  assert.equal(bankSecurity.payoutBankDetails({ ...approved, bankVerificationStatus: "pending_review" }), null, "pending change without a verified snapshot");
});

test("bank update schema validates every field and requires the current password", () => {
  const ok = bankSecurity.bankUpdateSchema.parse({ bankName: "HBL", accountTitle: "Ahmed Raza Khan", accountNumber: "1234 5678 901", iban: "", currentPassword: "pw" });
  assert.deepEqual([ok.accountNumber, ok.iban], ["12345678901", null]);
  for (const bad of [{ accountNumber: "abcd1234" }, { accountTitle: "12345" }, { iban: "PK00XXXX" }, { currentPassword: "" }, { bankName: "1" }]) {
    assert.equal(bankSecurity.bankUpdateSchema.safeParse({ bankName: "HBL", accountTitle: "Ahmed Raza Khan", accountNumber: "12345678901", currentPassword: "pw", ...bad }).success, false, JSON.stringify(bad));
  }
  assert.deepEqual(bankSecurity.maskedBank({ bankName: "HBL", accountTitle: "A B", accountNumber: "12345678901", iban: null }), { bankName: "HBL", accountTitle: "A B", accountNumber: "••••8901", iban: null });
});

function bankRoute(vendor: Record<string, unknown>) {
  const calls = { updates: [] as unknown[], audits: [] as unknown[], emails: [] as unknown[], notifications: [] as unknown[] };
  const imports: Record<string, unknown> = {
    "next/server": { NextResponse }, bcryptjs: { default: bcrypt },
    "@/lib/vendor-api-auth": { requireApprovedVendorApi: async () => ({ vendor: { id: "v1" } }) },
    "@/lib/prisma": { prisma: {
      vendor: { findUnique: async () => vendor, update: (args: unknown) => { calls.updates.push(args); return args; } },
      vendorAuditLog: { create: (args: unknown) => { calls.audits.push(args); return args; } },
      $transaction: async (ops: unknown[]) => ops,
    } },
    "@/lib/marketplace-api": { ApiError, sameOrigin },
    "@/lib/security/rate-limit": { consumeOrReject: async () => ({ ok: true }), createLoginRateLimiter: () => ({}) },
    "@/lib/vendor-ip": { clientIp: () => "203.0.113.5" },
    "@/lib/vendor-bank-security": bankSecurity,
    "@/lib/validation/bank": bank,
    "@/lib/vendor-notifications": { createVendorNotification: async (args: unknown) => { calls.notifications.push(args); } },
    "@/lib/vendor-mail": { sendVendorBankChangedEmail: async (...args: unknown[]) => { calls.emails.push(args); } },
  };
  const output = ts.transpileModule(readFileSync(path.join(repo, "app/api/vendor/bank/route.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported: { PATCH?: (req: Request) => Promise<Response> } = {};
  runInNewContext(output, { exports: exported, console, require: (name: string) => { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; } });
  const patch = (body: unknown, origin = "https://joro.pk") => exported.PATCH!(new Request("https://joro.pk/api/vendor/bank", { method: "PATCH", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }));
  return { patch, calls };
}

test("bank API: wrong password, invalid data and cross-site requests are refused; a change alerts the seller with masked data", async () => {
  const vendor = { ...approved, email: "seller@example.pk", passwordHash: await bcrypt.hash("right-password", 4) };
  const route = bankRoute(vendor);
  const body = { bankName: "Meezan Bank", accountTitle: "Ahmed Raza Khan", accountNumber: "55556666777", iban: null, currentPassword: "right-password" };
  assert.equal((await route.patch({ ...body, currentPassword: "wrong" })).status, 403);
  assert.equal((await route.patch({ ...body, accountNumber: "letters!" })).status, 400);
  assert.equal((await route.patch(body, "https://attacker.invalid")).status, 403);
  assert.equal(route.calls.updates.length, 0);
  const response = await route.patch(body);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "pending_review");
  assert.equal(((route.calls.updates[0] as { data: Record<string, unknown> }).data).bankVerificationStatus, "pending_review");
  const audit = JSON.stringify(route.calls.audits);
  assert.ok(audit.includes("••••6777") && !audit.includes("55556666777"), "audit history is masked");
  assert.ok(JSON.stringify(route.calls.notifications).includes("••••6777"));
  assert.equal(route.calls.emails.length, 1);
});
