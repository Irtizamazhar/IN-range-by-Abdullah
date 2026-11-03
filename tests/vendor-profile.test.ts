import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { api, ApiError, sameOrigin } from "../lib/marketplace-api";

function routeFixture() {
  let vendor: { id: string; status: string } | null = { id: "vendor-1", status: "approved" };
  const updates: Record<string, unknown>[] = [];
  const audits: unknown[] = [];
  const row: Record<string, unknown> = { id: "vendor-1", status: "approved", shopName: "GadgetHub", storeSlug: "gadgethub", shopDescription: "", primaryCategory: "Other", shopLogo: "/uploads/vendor-products/vendor-1/logo.webp", storeBanner: null, city: "Taxila", address: "Main Bazar", _count: { products: 3 } };
  const prisma = {
    vendor: {
      findUnique: async () => ({ ...row }),
      update: async ({ data }: { data: Record<string, unknown> }) => { updates.push(data); Object.assign(row, data); return { id: "vendor-1" }; },
    },
    marketplaceAudit: { create: async ({ data }: { data: unknown }) => { audits.push(data); return data; } },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const imports: Record<string, unknown> = {
    zod: { z },
    "@/lib/prisma": { prisma },
    "@/lib/marketplace-api": { api, ApiError, sameOrigin },
    "@/lib/vendor-auth-server": { getVendorFromSession: async () => vendor ? { vendor } : null },
    "@/lib/categories-store": { readCategories: async () => [{ id: 1, name: "Mobiles & Accessories" }, { id: 2, name: "Other" }] },
    "@/lib/vendor-location-request": { readLocationRequest: () => null, publicLocationRequest: () => null },
  };
  const output = ts.transpileModule(readFileSync(resolve("app/api/vendor/profile/route.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported: { GET?: () => Promise<Response>; PATCH?: (request: Request) => Promise<Response> } = {};
  runInNewContext(output, { exports: exported, require: (name: string) => { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; } });
  const valid = { shopName: "GadgetHub", shopDescription: "Smart gadgets", primaryCategory: "Mobiles & Accessories", shopLogo: "/uploads/vendor-products/vendor-1/new.webp", storeBanner: "" };
  const patch = (body: unknown, origin = "https://joro.pk") => exported.PATCH!(new Request("https://joro.pk/api/vendor/profile", { method: "PATCH", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) }));
  return { get: () => exported.GET!(), patch, valid, updates, audits, row, setVendor: (value: typeof vendor) => { vendor = value; } };
}

test("profile API reads the vendor's own profile with its product count and requires sign-in", async () => {
  const route = routeFixture();
  const body = await (await route.get()).json();
  assert.equal(body.profile.city, "Taxila");
  assert.equal(body.profile.productCount, 3);
  assert.equal("_count" in body.profile, false);
  route.setVendor(null);
  assert.equal((await route.get()).status, 401);
  assert.equal((await route.patch(route.valid)).status, 401);
});

test("profile API updates only permitted fields with an audit entry", async () => {
  const route = routeFixture();
  const response = await route.patch(route.valid);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(route.updates[0]).sort(), ["primaryCategory", "shopDescription", "shopLogo", "shopName", "storeBanner"]);
  assert.equal(route.audits.length, 1);
  assert.equal((await response.json()).profile.productCount, 3);
});

test("profile API rejects mass assignment, social links, unknown categories, unsafe images, foreign origins and unapproved vendors", async () => {
  const route = routeFixture();
  for (const extra of [{ city: "Lahore" }, { address: "x" }, { storeSlug: "new" }, { status: "approved" }, { id: "vendor-2" }, { socialLinks: { facebook: "https://facebook.com/x" } }]) {
    assert.equal((await route.patch({ ...route.valid, ...extra })).status, 400, `rejects ${Object.keys(extra)[0]}`);
  }
  assert.equal((await route.patch({ ...route.valid, primaryCategory: "Made Up" })).status, 400);
  assert.equal((await route.patch({ ...route.valid, primaryCategory: "Other" })).status, 200, "current legacy category may be kept");
  assert.equal((await route.patch({ ...route.valid, shopLogo: "/uploads/../secret" })).status, 400);
  assert.equal((await route.patch({ ...route.valid, storeBanner: "http://insecure.example/banner.jpg" })).status, 400);
  assert.equal((await route.patch({ ...route.valid, shopName: "  " })).status, 400);
  assert.equal((await route.patch(route.valid, "https://attacker.invalid")).status, 403);
  route.setVendor({ id: "vendor-1", status: "pending" });
  assert.equal((await route.patch(route.valid)).status, 403);
  assert.equal(route.updates.length, 1, "only the one valid save was written");
});

function locationFixture() {
  const vendor: Record<string, unknown> = { email: "seller@example.invalid", status: "approved", city: "Taxila", address: "Model Town, Taxila", onboardingData: { step: 4 } };
  const tickets: Record<string, unknown>[] = [];
  const messages: Record<string, unknown>[] = [];
  const notifications: unknown[] = [];
  const audits: unknown[] = [];
  const tx = {
    vendor: { findUnique: async () => ({ ...vendor }), update: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(vendor, data); return vendor; } },
    supportTicket: { update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { const t = tickets.find(x => x.id === where.id)!; Object.assign(t, data); return t; } },
    supportMessage: { create: async ({ data }: { data: Record<string, unknown> }) => { messages.push(data); return data; } },
  };
  const prisma = { ...tx, $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) };
  const imports: Record<string, unknown> = {
    zod: { z }, "@prisma/client": { Prisma }, "@/lib/prisma": { prisma },
    "@/lib/marketplace-api": { ApiError },
    "@/lib/security/sanitize": { sanitizePlainText: (v: string) => v },
    "@/lib/support-service": {
      createSupportTicket: async (opts: Record<string, unknown>) => { const t = { id: `t${tickets.length + 1}`, sequence: tickets.length + 1, status: "OPEN", ...opts }; tickets.push(t); return t; },
      formatTicketNumber: (n: number) => `JORO-${10000 + n}`, ticketHref: (_: string, id: string) => `/vendor/dashboard/help/tickets/${id}`,
    },
    "@/lib/marketplace-notifications": { notifyVendor: async (...args: unknown[]) => { notifications.push(args); } },
    "@/lib/admin-rbac": { writeAdminAudit: async (_db: unknown, data: unknown) => { audits.push(data); } },
  };
  const output = ts.transpileModule(readFileSync(resolve("lib/vendor-location-request.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const lib: Record<string, unknown> = {};
  runInNewContext(output, { exports: lib, require: (name: string) => { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; } });
  return { lib: lib as unknown as typeof import("../lib/vendor-location-request"), vendor, tickets, messages, notifications, audits };
}

test("location change request opens a linked ticket and never edits the location itself", async () => {
  const f = locationFixture();
  const request = await f.lib.createLocationRequest("v1", { city: "Lahore", address: "Shop 4, Hall Road", reason: "Shop moved to Lahore" });
  assert.equal(request.status, "PENDING");
  assert.equal(f.vendor.city, "Taxila", "city unchanged until approval");
  assert.equal(f.tickets[0].relatedResourceType, "LOCATION_CHANGE");
  assert.equal(f.tickets[0].relatedResourceId, "v1");
  assert.equal((f.vendor.onboardingData as Record<string, unknown>).step, 4, "other private data kept");
  await assert.rejects(f.lib.createLocationRequest("v1", { city: "Karachi", address: "Saddar, Karachi", reason: "Another move" }), /already have a location change/);
  assert.equal(f.lib.publicLocationRequest(request)?.ticketHref, "/vendor/dashboard/help/tickets/t1");
  assert.equal("previousAddress" in (f.lib.publicLocationRequest(request) || {}), false);
});

test("location request input is validated and must differ from the current location", async () => {
  const f = locationFixture();
  await assert.rejects(f.lib.createLocationRequest("v1", { city: "Taxila", address: "Model Town, Taxila", reason: "Just checking" }), /already your registered location/);
  await assert.rejects(f.lib.createLocationRequest("v1", { city: "L", address: "x", reason: "" }));
  await assert.rejects(f.lib.createLocationRequest("v1", { city: "Lahore", address: "Hall Road", reason: "Moved", status: "APPROVED" }));
  f.vendor.status = "suspended";
  await assert.rejects(f.lib.createLocationRequest("v1", { city: "Lahore", address: "Hall Road", reason: "Moved" }), /Approved vendor/);
  assert.equal(f.tickets.length, 0);
});

test("admin approval updates city/address, resolves the ticket and notifies; rejection needs a note and changes nothing", async () => {
  const f = locationFixture();
  await f.lib.createLocationRequest("v1", { city: "Lahore", address: "Shop 4, Hall Road", reason: "Shop moved" });
  await assert.rejects(f.lib.reviewLocationRequest("admin-1", "v1", { ticketId: "wrong", action: "approve" }), /not found/);
  await assert.rejects(f.lib.reviewLocationRequest("admin-1", "v1", { ticketId: "t1", action: "reject", note: "" }));
  const approved = await f.lib.reviewLocationRequest("admin-1", "v1", { ticketId: "t1", action: "approve" });
  assert.equal(approved.status, "APPROVED");
  assert.equal(f.vendor.city, "Lahore");
  assert.equal(f.vendor.address, "Shop 4, Hall Road");
  assert.equal(f.tickets[0].status, "RESOLVED");
  assert.equal(f.messages.length, 1);
  assert.equal(f.notifications.length, 1);
  assert.equal(f.audits.length, 1);
  await assert.rejects(f.lib.reviewLocationRequest("admin-1", "v1", { ticketId: "t1", action: "reject", note: "Too late" }), /already approved/);

  await f.lib.createLocationRequest("v1", { city: "Karachi", address: "Saddar, Karachi", reason: "Second move" });
  const rejected = await f.lib.reviewLocationRequest("admin-1", "v1", { ticketId: "t2", action: "reject", note: "Address could not be verified" });
  assert.equal(rejected.status, "REJECTED");
  assert.equal(f.vendor.city, "Lahore", "rejection keeps the current location");
});
