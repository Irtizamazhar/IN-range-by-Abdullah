import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import sharp from "sharp";
import { NextResponse } from "next/server";
import * as marketplace from "../lib/marketplace-api";
import { serviceImageCandidates, serviceImagePath, isServiceImageUrl } from "../lib/service-image-policy";
import { assertServiceImageStored, uploadServiceImage } from "../lib/service-images";
import { GET as imageGET } from "../app/api/uploads/[...path]/route";
import { listingData } from "../lib/service-management";
import { signPlace } from "../lib/service-locations";
import * as management from "../lib/service-management";
import * as images from "../lib/service-images";
import { Prisma } from "@prisma/client";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ServiceCard } from "../components/user/services/ServiceCard";
import { ServiceImage } from "../components/user/services/ServiceImage";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- In-memory API adapters, no live database.
type Adapter = Record<string, any>;
function load(file: string, modules: Adapter): Adapter {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: (name: string) => modules[name] ?? require(name), Request, Response, File, URL, Buffer, Date, console });
  return exports;
}
const imageUrl = (owner: string, id = "12345678-1234-1234-1234-123456789abc") => `/uploads/services/${owner}/svc-123-${id}.png`;

test("service image hierarchy and URL policy preserve Cloudinary and reject arbitrary/private references", () => {
  const custom = imageUrl("vendor-a"), fallback = imageUrl("catalog");
  assert.deepEqual(serviceImageCandidates(custom, fallback), [custom, fallback]);
  assert.deepEqual(serviceImageCandidates(null, fallback), [fallback]);
  assert.deepEqual(serviceImageCandidates(null, null), []);
  assert.deepEqual(serviceImageCandidates(custom, custom), [custom]);
  assert.ok(isServiceImageUrl("https://res.cloudinary.com/existing/image/upload/v1/services/photo.jpg"));
  for (const url of ["https://evil.test/a.png", "/uploads/vendor-docs/x.png", "/uploads/services/../x.png", imageUrl("vendor-a") + "?x=1", "javascript:alert(1)"]) assert.equal(isServiceImageUrl(url), false);
  assert.equal(serviceImagePath(custom)?.owner, "vendor-a");
});

test("service cards, featured cards and actual detail page select and render listing/default images", async () => {
  const custom = imageUrl("vendor-a"), fallback = imageUrl("catalog");
  const row = { id: "service", name: "Fixture service", description: "Fixture", type: "Fixture", price: 2500, cities: [], imageUrl: custom, catalog: { imageUrl: fallback }, vendor: { id: "vendor-a", shopName: "Provider", storeSlug: null } };
  for (const featured of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(ServiceCard, { service: row, featured }));
    assert.ok(html.includes(encodeURIComponent(custom))); assert.ok(html.includes("object-cover"));
    assert.ok(renderToStaticMarkup(React.createElement(ServiceCard, { service: { ...row, imageUrl: null }, featured })).includes(encodeURIComponent(fallback)));
  }
  assert.match(renderToStaticMarkup(React.createElement(ServiceImage, { alt: "Service", imageUrl: null })), /JORO/);
  const detail = load("app/(user)/services/[id]/page.tsx", { "@/lib/prisma": { prisma: { serviceOffering: { findFirst: async ({ select, where }: Adapter) => {
    assert.equal(select.imageUrl, true); assert.equal(select.catalog.select.imageUrl, true); assert.equal(where.moderationStatus, "APPROVED"); return row;
  } } } }, "@/lib/public-services": { publicServices: async () => [] },
    "@/components/user/services/ServiceImage": { ServiceImage }, "@/components/user/services/ServiceCard": { ServiceCard },
    "@/components/ui/LoadingLink": { default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", props) },
    "next/navigation": { notFound: () => { throw new Error("Not found"); } },
  });
  const html = renderToStaticMarkup(await detail.default({ params: { id: "service" } }));
  assert.ok(html.includes(encodeURIComponent(custom)));
});

test("service image endpoints enforce admin/vendor authentication and server-resolved ownership", async () => {
  let calls = 0, owner = "";
  const adapters = { "@/lib/marketplace-api": marketplace, "@/lib/service-images": { uploadServiceImage: async (_r: Request, selected: string) => { calls++; owner = selected; return NextResponse.json({ url: imageUrl(selected) }); } } };
  const denied = { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const adminDenied = load("app/api/admin/services/image/route.ts", { ...adapters, "@/lib/admin-rbac": { requireAdminPermission: async () => denied }, "@/lib/prisma": {} });
  assert.equal((await adminDenied.POST(new Request("https://joro.pk/api/admin/services/image", { method: "POST" }))).status, 401);
  const vendorDenied = load("app/api/vendor/services/image/route.ts", { ...adapters, "@/lib/vendor-api-auth": { requireApprovedVendorApi: async () => denied } });
  assert.equal((await vendorDenied.POST(new Request("https://joro.pk/api/vendor/services/image", { method: "POST" }))).status, 401);
  assert.equal(calls, 0);
  const vendor = load("app/api/vendor/services/image/route.ts", { ...adapters, "@/lib/vendor-api-auth": { requireApprovedVendorApi: async () => ({ vendor: { id: "own-provider" } }) } });
  assert.equal((await vendor.POST(new Request("https://joro.pk/api/vendor/services/image?vendorId=other&kind=catalog", { method: "POST" }))).status, 200);
  assert.equal(owner, "vendor-own-provider");
  const admin = load("app/api/admin/services/image/route.ts", { ...adapters, "@/lib/admin-rbac": { requireAdminPermission: async (permission: string) => { assert.equal(permission, "moderation.manage"); return { admin: { id: "admin" } }; } }, "@/lib/prisma": { prisma: { vendor: { findFirst: async () => null } } } });
  assert.equal((await admin.POST(new Request("https://joro.pk/api/admin/services/image?kind=listing&vendorId=missing", { method: "POST" }))).status, 400);
  assert.equal((await admin.POST(new Request("https://joro.pk/api/admin/services/image?kind=catalog", { method: "POST" }))).status, 200);
  assert.equal(owner, "catalog");
});

test("service upload validates real images, retains originals, serves immediately and rejects cross-vendor saves", async () => {
  const cache = path.resolve("node_modules/.cache"); await fs.mkdir(cache, { recursive: true });
  const root = await fs.mkdtemp(path.join(cache, "service-images-test-"));
  const previous = process.env.UPLOADS_DIR;
  const previousSecret = process.env.SERVICE_LOCATION_SECRET;
  process.env.UPLOADS_DIR = root;
  const bytes = await sharp({ create: { width: 4, height: 3, channels: 3, background: "#005055" } }).png().toBuffer();
  const request = (data: Buffer, type = "image/png", origin = "https://joro.pk") => {
    const form = new FormData(); form.set("file", new File([new Uint8Array(data)], "service.png", { type }));
    return new Request("https://joro.pk/api/vendor/services/image", { method: "POST", headers: { origin }, body: form });
  };
  try {
    const first = await (await uploadServiceImage(request(bytes), "vendor-test-owner")).json();
    const second = await (await uploadServiceImage(request(bytes), "vendor-test-owner")).json();
    assert.notEqual(first.url, second.url);
    await assertServiceImageStored(first.url, "vendor-test-owner");
    await assertServiceImageStored(null, "vendor-test-owner");
    await assert.rejects(assertServiceImageStored(first.url, "vendor-other"), /provider/);
    await assert.rejects(assertServiceImageStored(first.url, "catalog"), /provider/);
    const response = await imageGET(new Request("https://joro.pk" + first.url), { params: { path: first.url.slice(9).split("/") } });
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.deepEqual(await fs.readFile(path.join(root, first.url.slice(9))), bytes);
    process.env.SERVICE_LOCATION_SECRET = "isolated-service-image-coverage-secret";
    const city = signPlace({ id: "osm:n:1001", name: "Fixture city", label: "Fixture city, Pakistan", kind: "city", proof: {
      version: 2, providerId: "fixture", sourceId: "osm:n:1001", boundaryIds: ["osm:r:600"], cityNames: ["fixture city"], method: "source-hierarchy",
    } }, null);
    const existing = { id: "listing", vendorId: "test-owner", catalogId: "catalog", imageUrl: null, moderationStatus: "APPROVED", updatedAt: new Date(), name: "Fixture", type: "Fixture" };
    const tx = { serviceOffering: { findFirst: async ({ where }: Adapter) => where.id === existing.id && where.vendorId === existing.vendorId ? existing : null }, serviceCatalog: { findFirst: async () => ({ id: "catalog", active: true, name: "Fixture", category: "Fixture", defaultPrice: 2500 }) } };
    const body = { id: existing.id, version: existing.updatedAt.toISOString(), catalogId: "catalog", imageUrl: first.url, description: "Fixture description", price: 3100, priceType: "FIXED", coverage: [{ city, entireCity: true, areas: [] }], durationMinutes: 60, leadDays: 1, warranty: "", cancellationTerms: "Fixture terms", active: true };
    const saved = await listingData(tx as unknown as Prisma.TransactionClient, body, "test-owner");
    assert.equal(saved.data.imageUrl, first.url); assert.equal(saved.data.price, 3100);
    assert.equal(saved.data.cities[0], "Fixture city");
    assert.equal((await listingData(tx as unknown as Prisma.TransactionClient, { ...body, imageUrl: null }, "test-owner")).data.imageUrl, null);
    await assert.rejects(listingData(tx as unknown as Prisma.TransactionClient, body, "another-vendor"), /not found/);
    const defaultImage = await (await uploadServiceImage(request(bytes), "catalog")).json();
    let template: Adapter = { id: "catalog", imageUrl: null, defaultPrice: 2500 };
    const catalogDb: Adapter = { serviceCatalog: { findUnique: async () => template, update: async ({ data }: Adapter) => template = { ...template, ...data } } };
    catalogDb.$transaction = async (work: (db: Adapter) => unknown) => work(catalogDb);
    const catalogApi = load("app/api/admin/services/catalog/route.ts", { "@/lib/prisma": { prisma: catalogDb }, "@/lib/marketplace-api": marketplace,
      "@/lib/service-management": management, "@/lib/service-images": images, "@/lib/admin-rbac": { requireAdminPermission: async () => ({ admin: { id: "fixture-admin" } }), writeAdminAudit: async () => undefined } });
    const catalogRequest = (imageUrl: string | null) => new Request("https://joro.pk/api/admin/services/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "catalog", name: "Fixture", category: "Fixture", description: "Fixture", defaultPrice: 2500, priceType: "FIXED", active: true, imageUrl }) });
    assert.equal((await catalogApi.POST(catalogRequest(defaultImage.url))).status, 200); assert.equal(template.imageUrl, defaultImage.url);
    assert.equal((await catalogApi.POST(catalogRequest(first.url))).status, 400); assert.equal(template.imageUrl, defaultImage.url);
    assert.equal((await catalogApi.POST(catalogRequest(null))).status, 200); assert.equal(template.imageUrl, null); assert.equal(template.defaultPrice, 2500);
    await assert.rejects(uploadServiceImage(request(bytes, "image/png", "https://evil.test"), "vendor-security"), /origin/);
    await assert.rejects(uploadServiceImage(request(Buffer.from("<svg/>"), "image/svg+xml"), "vendor-security"), /valid JPG/);
    await assert.rejects(uploadServiceImage(request(bytes.subarray(0, 8)), "vendor-security"), /valid JPG/);
    await assert.rejects(uploadServiceImage(request(Buffer.alloc(5 * 1024 * 1024 + 1)), "vendor-security"), /5MB/);
    await assert.rejects(uploadServiceImage(request(bytes), "../private"), /owner/);
    process.env.UPLOADS_DIR = path.join(root, "missing-storage");
    await assert.rejects(uploadServiceImage(request(bytes), "vendor-failure"), /upload failed/);
    process.env.UPLOADS_DIR = root;
    assert.deepEqual(await fs.readFile(path.join(root, first.url.slice(9))), bytes);
  } finally {
    if (previous === undefined) delete process.env.UPLOADS_DIR; else process.env.UPLOADS_DIR = previous;
    if (previousSecret === undefined) delete process.env.SERVICE_LOCATION_SECRET; else process.env.SERVICE_LOCATION_SECRET = previousSecret;
    if (root.startsWith(`${cache}${path.sep}service-images-test-`)) await fs.rm(root, { recursive: true, force: true });
  }
});
