import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { api, ApiError, sameOrigin } from "../lib/marketplace-api";
import { vendorSetupDraftSchema, vendorSetupSchema, setupStepErrors } from "../lib/vendor-onboarding-schema";

function routeFixture() {
  let vendor: { id: string; status: string } | null = { id: "vendor-1", status: "onboarding" };
  const saved: unknown[] = [];
  let saveError: Error | null = null;
  const imports: Record<string, unknown> = {
    "@/lib/vendor-mail": { sendVendorVerificationEmail: async () => {} },
    "@/lib/prisma": { prisma: { vendorDocument: { findMany: async () => [{ id: "f", documentType: "cnic_front" }, { id: "b", documentType: "cnic_back" }] } } },
    "@/lib/marketplace-api": { api, ApiError, sameOrigin },
    "@/lib/vendor-auth-server": { getVendorFromSession: async () => vendor ? { vendor } : null },
    "@/lib/vendor-onboarding": {
      vendorSetupDraftSchema, vendorSetupSchema,
      saveVendorSetup: async (_id: string, data: unknown) => { if (saveError) throw saveError; saved.push(data); },
      submitVendorSetup: async () => ({ ok: true, status: "pending", next: "/vendor/status" }),
      currentSetupCnic: () => "",
    },
    "@/lib/vendor-onboarding-schema": { setupStepErrors },
    "@/lib/vendor-doc-upload": { saveVendorDocumentBuffer: async (_vendorId: string, type: string) => ({ id: `${type}-doc`, documentType: type, sha256: "0".repeat(64) }) },
    "@/lib/security/image-signature": { imageExtension: () => "png" },
    "next/server": { NextResponse },
    "@prisma/client": { Prisma },
  };
  const output = ts.transpileModule(readFileSync(resolve("app/api/vendor/onboarding/route.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported: { PATCH?: (request: Request) => Promise<Response>; POST?: (request: Request) => Promise<Response> } = {};
  // Deliberately omit global File, matching supported Node 18 deployments.
  runInNewContext(output, { exports: exported, require: (name: string) => { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; }, Buffer });
  const request = (body: unknown, origin = "https://joro.pk") => new Request("https://joro.pk/api/vendor/onboarding", { method: "PATCH", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
  return { patch: (body: unknown, origin?: string) => exported.PATCH!(request(body, origin)), multipart: (body: FormData) => exported.PATCH!(new Request("https://joro.pk/api/vendor/onboarding", { method: "PATCH", headers: { origin: "https://joro.pk" }, body })), post: (body: unknown) => exported.POST!(request(body)), saved, setVendor: (value: typeof vendor) => { vendor = value; }, setError: (error: Error) => { saveError = error; } };
}

test("onboarding API protects authentication, origin and application status", async () => {
  const route = routeFixture();
  route.setVendor(null);
  assert.equal((await route.patch({})).status, 401);
  route.setVendor({ id: "vendor-1", status: "approved" });
  assert.equal((await route.patch({})).status, 409);
  route.setVendor({ id: "vendor-1", status: "onboarding" });
  assert.equal((await route.patch({}, "https://attacker.invalid")).status, 403);
  assert.equal(route.saved.length, 0);
});

test("onboarding API returns real field errors and rejects invalid continuation metadata", async () => {
  const route = routeFixture();
  const response = await route.patch({ intent: "continue", currentStep: 0, step: 1, city: "" });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(body.fieldErrors.city);
  assert.ok(body.error);
  assert.equal(route.saved.length, 0);
  assert.equal((await route.patch({ intent: "continue", currentStep: 0, step: 4 })).status, 400);
  assert.equal((await route.patch(null)).status, 400);
  const submit = await route.post({ name: "Incomplete" });
  assert.equal(submit.status, 400);
  assert.ok((await submit.json()).fieldErrors.cnic);
});

test("onboarding API confirms successful drafts and reports server errors without false success", async () => {
  const route = routeFixture();
  const response = await route.patch({ city: "Lahore", step: 0 });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.deepEqual(route.saved, [{ city: "Lahore", step: 0 }]);
  route.setError(new ApiError(409, "That store URL is already in use.", { storeSlug: "Choose another store URL." }));
  const failed = await route.patch({ city: "Karachi", step: 1 });
  assert.equal(failed.status, 409);
  const failure = await failed.json();
  assert.equal(failure.ok, undefined);
  assert.ok(failure.fieldErrors.storeSlug);
  assert.equal(route.saved.length, 1);
});

test("multipart Save & Continue succeeds without a global File constructor (Node 18 regression)", async () => {
  const route = routeFixture();
  const form = new FormData();
  for (const [key, value] of Object.entries({ intent: "continue", currentStep: "0", step: "1", shopName: "Test Store", storeSlug: "test-store", category: "Other", shopDescription: "Quality Pakistani products.", phone: "03001234567", address: "123 Test Street", city: "Lahore", province: "Punjab", businessType: "individual" })) form.set(key, value);
  const response = await route.multipart(form);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal((route.saved[0] as { step: number }).step, 1);
});

test("uploading one CNIC side on its own saves the file and its name (regression)", async () => {
  const route = routeFixture();
  const form = new FormData();
  form.set("step", "1");
  form.set("cnic_front", new Blob([Buffer.from("iVBORw0KGgo=", "base64")], { type: "image/png" }), "cnic-front.png");
  const response = await route.multipart(form);
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.deepEqual((route.saved[0] as { documentNames: unknown }).documentNames, { cnic_front: "cnic-front.png" });
});

function adminVendorsFixture() {
  const wheres: unknown[] = [];
  const imports: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/admin-rbac": { requireAdminPermission: async () => ({ admin: { id: "admin-1" } }) },
    "@/lib/vendor-suspension": { sweepExpiredSuspensions: async () => {} },
    "@/lib/prisma": { prisma: { vendor: {
      count: async ({ where }: { where: unknown }) => { wheres.push(where); return 0; },
      findMany: async ({ where }: { where: unknown }) => { wheres.push(where); return []; },
    } } },
  };
  const output = ts.transpileModule(readFileSync(resolve("app/api/admin/vendors/route.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported: { GET?: (request: { nextUrl: URL }) => Promise<Response> } = {};
  runInNewContext(output, { exports: exported, console, require: (name: string) => { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; } });
  return { wheres, list: (query = "") => exported.GET!({ nextUrl: new URL(`https://joro.pk/api/admin/vendors${query}`) }) };
}

test("admin vendor list never returns an unfinished seller setup", async () => {
  const hidden = { status: { not: "onboarding" } };
  for (const query of ["", "?status=onboarding"]) {
    const route = adminVendorsFixture();
    assert.equal((await route.list(query)).status, 200);
    assert.deepEqual(JSON.parse(JSON.stringify(route.wheres)), [hidden, hidden]);
  }
  const route = adminVendorsFixture();
  await route.list("?status=pending");
  assert.deepEqual(JSON.parse(JSON.stringify(route.wheres)), [{ status: "pending" }, { status: "pending" }]);
});
