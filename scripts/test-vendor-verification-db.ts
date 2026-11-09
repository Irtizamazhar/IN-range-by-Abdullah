/**
 * Disposable-MySQL verification of vendor onboarding, approval rules, private document storage and
 * payout protection, using the real Prisma models and library code. Creates a uniquely named local
 * database, applies every committed migration, runs the checks and drops only that database.
 * Never connects to the configured application database.
 *
 *   npm run test:verification:db
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { parse } from "dotenv";
import sharp from "sharp";

const databaseName = `joro_verification_test_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
const config = parse(fs.readFileSync(".env"));
const source = new URL(process.env.JORO_LOCAL_TEST_ADMIN_URL || config.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(source.hostname), "Only a local MySQL server may run this suite.");
assert.match(databaseName, /^joro_verification_test_\d+_[a-f0-9]{8}$/);
const systemUrl = new URL(source); systemUrl.pathname = "/mysql";
const testUrl = new URL(source); testUrl.pathname = `/${databaseName}`;
const system = new PrismaClient({ datasourceUrl: systemUrl.toString() });
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "joro-verification-"));
let created = false;
let checks = 0;
const pass = (label: string) => { checks++; console.log(`PASS DB ${checks}: ${label}`); };
const cli = (args: string[]) => {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], { env: { ...process.env, DATABASE_URL: testUrl.toString(), NODE_ENV: "test" }, encoding: "utf8" });
  assert.equal(result.status, 0, `Isolated Prisma command failed: ${args.slice(0, 2).join(" ")}`);
};

async function main() {
  await system.$executeRawUnsafe(`CREATE DATABASE \`${databaseName}\``);
  created = true;
  Object.assign(process.env, { DATABASE_URL: testUrl.toString(), NODE_ENV: "test", PRIVATE_STORAGE_DIR: storageDir, VENDOR_REQUIRE_EMAIL_VERIFICATION: "false" });
  cli(["migrate", "deploy"]);
  cli(["migrate", "diff", "--from-url", testUrl.toString(), "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"]);
  const probe = new PrismaClient({ datasourceUrl: testUrl.toString() });
  const leftovers = await probe.$queryRawUnsafe<Array<{ n: bigint }>>("SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vendordocumentcheck'");
  await probe.$disconnect();
  assert.equal(Number(leftovers[0].n), 0, "OCR table must not exist after all migrations");
  pass("all committed migrations apply to an empty MySQL database, match schema.prisma, and leave no OCR table");

  const { prisma } = await import("../lib/prisma");
  const onboarding = await import("../lib/vendor-onboarding");
  const { saveVendorDocumentBuffer } = await import("../lib/vendor-doc-upload");
  const { approvalReadiness } = await import("../lib/vendor-approval");
  const { payoutBankDetails, bankChangeUpdate, verifiedBankSnapshot } = await import("../lib/vendor-bank-security");
  const { ApiError } = await import("../lib/marketplace-api");

  let shade = 0;
  const freshImage = () => { shade++; return sharp({ create: { width: 1000, height: 640, channels: 3, background: { r: 200, g: (shade * 7) % 256, b: (shade * 13) % 256 } } }).jpeg().toBuffer(); };
  const makeVendor = async (email: string) => prisma.vendor.create({ data: { ownerName: "Ahmed Raza Khan", email, phone: "0300-1234567", passwordHash: "x", address: "", status: "onboarding" } });
  const setup = (cnic: string, name = "Ahmed Raza Khan") => ({
    shopName: `Store ${randomUUID().slice(0, 6)}`, category: "Other", phone: "03001234567", address: "12 Mall Road", city: "Lahore", province: "Punjab", businessType: "individual",
    name, cnic, pickupAddress: "12 Mall Road", pickupCity: "Lahore", pickupProvince: "Punjab", pickupContactName: name, pickupPhone: "03001234567",
    returnSameAsPickup: true, bankName: "HBL", accountTitle: name, accountNumber: "12345678901", declarationAccepted: true,
  });
  const expectApiError = async (work: Promise<unknown>, status: number, pattern: RegExp) => {
    await assert.rejects(work, (error: unknown) => error instanceof ApiError && error.status === status && pattern.test(error.message));
  };

  // 1. Drafts never reserve a CNIC in the unique column.
  const squatter = await makeVendor("squatter@example.invalid");
  await onboarding.saveVendorSetup(squatter.id, { cnic: "35202-1234567-1", step: 1 });
  const squatRow = await prisma.vendor.findUniqueOrThrow({ where: { id: squatter.id } });
  assert.equal(squatRow.cnic, null);
  assert.equal(onboarding.currentSetupCnic(squatRow), "35202-1234567-1");
  pass("a draft keeps the CNIC privately and never occupies the unique cnic column");

  // 2. Submission needs both CNIC images.
  const seller = await makeVendor("seller@example.invalid");
  await saveVendorDocumentBuffer(seller.id, "cnic_front", await freshImage(), "image/jpeg");
  await expectApiError(onboarding.submitVendorSetup(seller.id, setup("35202-1234567-1")), 400, /Upload all required verification documents/);
  await saveVendorDocumentBuffer(seller.id, "cnic_back", await freshImage(), "image/jpeg");
  const submitted = await onboarding.submitVendorSetup(seller.id, setup("3520212345671"));
  assert.equal(submitted.status, "pending");
  const sellerRow = await prisma.vendor.findUniqueOrThrow({ where: { id: seller.id } });
  assert.deepEqual([sellerRow.status, sellerRow.cnic], ["pending", "35202-1234567-1"]);
  const front = await prisma.vendorDocument.findFirstOrThrow({ where: { vendorId: seller.id, documentType: "cnic_front" } });
  assert.ok(fs.existsSync(path.join(storageDir, ...front.fileUrl.split("/"))), "file stored in PRIVATE_STORAGE_DIR");
  pass("submission requires both CNIC images; CNIC normalised; files stored in persistent private storage");

  // 3. The same CNIC cannot be used by another seller (the earlier draft did not block the real owner).
  await saveVendorDocumentBuffer(squatter.id, "cnic_front", await freshImage(), "image/jpeg");
  await saveVendorDocumentBuffer(squatter.id, "cnic_back", await freshImage(), "image/jpeg");
  await expectApiError(onboarding.submitVendorSetup(squatter.id, setup("35202-1234567-1")), 409, /already registered/);
  pass("a second account cannot submit a CNIC already registered to another seller");

  // 4. Approval rules on real rows.
  const ready = await approvalReadiness(seller.id);
  assert.deepEqual([ready?.canApprove, ready?.blockers.length, ready?.reviewItems.length], [true, 0, 0]);
  const titled = await makeVendor("titled@example.invalid");
  await saveVendorDocumentBuffer(titled.id, "cnic_front", await freshImage(), "image/jpeg");
  await saveVendorDocumentBuffer(titled.id, "cnic_back", await freshImage(), "image/jpeg");
  await onboarding.submitVendorSetup(titled.id, { ...setup("35203-1234567-1"), accountTitle: "Bilal Traders" });
  const titledReadiness = await approvalReadiness(titled.id);
  assert.equal(titledReadiness?.canApprove, true);
  assert.ok(titledReadiness?.reviewItems.some(item => /account title/.test(item)));
  pass("approval readiness: a complete application is approvable; an account title that differs from the CNIC name needs an override");

  // 5. Missing file (e.g. deleted by an old deployment) blocks approval.
  fs.rmSync(path.join(storageDir, "vendor-docs", titled.id), { recursive: true, force: true });
  assert.ok((await approvalReadiness(titled.id))?.blockers.some(item => /missing from storage/.test(item)));
  pass("approval is blocked when a document record's file no longer exists");

  // 6. Payout protection on real rows.
  const approvedVendor = await prisma.vendor.update({ where: { id: seller.id }, data: { status: "approved", ...verifiedBankSnapshot({ bankName: "HBL", accountTitle: "Ahmed Raza Khan", accountNumber: "12345678901", iban: null }, "admin-test") } as never });
  const changed = await prisma.vendor.update({ where: { id: seller.id }, data: bankChangeUpdate(approvedVendor, { bankName: "Meezan Bank", accountTitle: "Ahmed Raza Khan", accountNumber: "55556666777", iban: null }) });
  assert.equal(changed.bankVerificationStatus, "pending_review");
  assert.equal(changed.accountNumber, "55556666777");
  assert.equal(payoutBankDetails(changed)?.accountNumber, "12345678901");
  pass("after approval a bank change is pending review and withdrawals still resolve to the verified account");

  console.log(`Disposable database verification complete: ${checks} groups passed. No external email or payment service was called.`);
}

main().catch(error => { console.error("Isolated database verification failed:", error instanceof assert.AssertionError ? error.message : error?.message || error?.code || "Unknown"); process.exitCode = 1; }).finally(async () => {
  try { const { prisma } = await import("../lib/prisma"); await prisma.$disconnect(); } catch { /* not loaded */ }
  if (created) { assert.match(databaseName, /^joro_verification_test_\d+_[a-f0-9]{8}$/); await system.$executeRawUnsafe(`DROP DATABASE \`${databaseName}\``); console.log("Removed only the newly created disposable database."); }
  await system.$disconnect();
  fs.rmSync(storageDir, { recursive: true, force: true });
});
