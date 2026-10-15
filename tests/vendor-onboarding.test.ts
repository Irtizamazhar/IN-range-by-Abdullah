import test from "node:test";
import assert from "node:assert/strict";
import { setupStepErrors, vendorSetupDraftSchema, vendorSetupSchema } from "../lib/vendor-onboarding-schema";
import { vendorSetupData, saveVendorSetup } from "../lib/vendor-onboarding";
import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";

const business = { shopName: "Test Store", storeSlug: "test-store", category: "Other", shopDescription: "Quality products from Pakistan.", phone: "03001234567", address: "123 Test Street", city: "Lahore", province: "Punjab", postalCode: "54000", businessType: "individual" };
const complete = { ...business, name: "Test Seller", cnic: "12345-1234567-1", pickupAddress: "123 Test Street", pickupCity: "Lahore", pickupProvince: "Punjab", pickupContactName: "Test Seller", pickupPhone: "03001234567", returnSameAsPickup: true, bankName: "Test Bank", accountTitle: "Test Seller", accountNumber: "12345678", declarationAccepted: true };

test("business step can advance without future identity or bank fields", () => {
  assert.deepEqual(setupStepErrors(business, 0), {});
  const errors = setupStepErrors({ ...business, city: "", province: "", phone: "123" }, 0);
  assert.ok(errors.city && errors.province && errors.phone);
  assert.equal(errors.cnic, undefined);
});

test("Individual and Business identity requirements remain distinct", () => {
  const identity = { name: "Test Seller", cnic: "12345-1234567-1", businessType: "individual" };
  assert.deepEqual(setupStepErrors(identity, 1), {});
  assert.ok(setupStepErrors({ ...identity, businessType: "company" }, 1).businessRegNo);
  assert.ok(setupStepErrors({ ...identity, businessType: "company" }, 1).businessLegalName);
  assert.deepEqual(setupStepErrors({ ...identity, businessType: "company", businessRegNo: "REG123", businessLegalName: "Example Ltd" }, 1), {});
});

test("return details are required for a separate address, including multipart booleans", () => {
  for (const returnSameAsPickup of [false, "false"]) assert.ok(setupStepErrors({ ...complete, returnSameAsPickup }, 2).returnAddress);
  assert.deepEqual(setupStepErrors(complete, 2), {});
  assert.ok(setupStepErrors({ ...complete, iban: "bad" }, 3).iban);
  assert.ok(setupStepErrors({ ...complete, declarationAccepted: false }, 4).declarationAccepted);
  assert.equal(vendorSetupSchema.safeParse(complete).success, true);
});

test("Save Progress accepts incomplete fields; private progress merges without loss", () => {
  const draft = vendorSetupDraftSchema.parse({ city: "", step: "0", returnSameAsPickup: "true" });
  assert.equal(draft.city, "");
  const first = vendorSetupData({ ...business, businessType: "individual", step: 1 });
  const second = vendorSetupData({ pickupCity: "Karachi", step: 2 }, first.onboardingData as Prisma.JsonValue);
  assert.equal((second.onboardingData as Record<string, unknown>).province, "Punjab");
  assert.equal((second.onboardingData as Record<string, unknown>).postalCode, "54000");
  assert.equal((second.onboardingData as Record<string, unknown>).pickupCity, "Karachi");
  assert.equal((second.onboardingData as Record<string, unknown>).step, 2);
  assert.equal(vendorSetupData({ cnic: "", iban: "" }).cnic, null);
});

test("save persists current progress and respects application status; failures reject", async () => {
  let status = "onboarding";
  let persisted: Record<string, unknown> = {};
  const tx = { vendor: {
    findUnique: async () => ({ status, onboardingData: { province: "Punjab" } }),
    update: async ({ data }: { data: Record<string, unknown> }) => { persisted = data; },
  } };
  const db = { $transaction: async (work: (client: unknown) => Promise<unknown>) => work(tx) } as unknown as typeof prisma;
  await saveVendorSetup("test-vendor", { city: "Karachi", step: 1 }, db);
  assert.equal(persisted.city, "Karachi");
  assert.deepEqual(persisted.onboardingData, { province: "Punjab", step: 1 });
  status = "approved";
  await assert.rejects(saveVendorSetup("test-vendor", { step: 2 }, db), /no longer editable/);
  status = "onboarding";
  tx.vendor.update = async () => { throw new Error("Database unavailable"); };
  await assert.rejects(saveVendorSetup("test-vendor", { step: 2 }, db), /Database unavailable/);
});
