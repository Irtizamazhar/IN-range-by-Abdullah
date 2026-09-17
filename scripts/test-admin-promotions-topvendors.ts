/** Run after npm run build. Uses only localhost DB/server and removes only this run's fixture IDs. */
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { existsSync } from "node:fs";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { SignJWT } from "jose";
import { chromium, type Browser } from "playwright-core";

config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
const localHosts = ["localhost", "127.0.0.1", "[::1]"];
assert.ok(process.env.DATABASE_URL && localHosts.includes(new URL(process.env.DATABASE_URL).hostname), "Promotions/Top Vendors tests require a local development database.");
assert.ok(existsSync(".next/BUILD_ID"), "Run npm run build first.");

const db = new PrismaClient();
const run = `promo-test-${randomUUID()}`;
const secret = randomUUID();
const vendorJwtSecret = randomBytes(32).toString("hex");
const port = 3116;
const base = `http://localhost:${port}`;
let server: ReturnType<typeof spawn> | undefined;
let browser: Browser | undefined;

const customerIds: string[] = []; const vendorIds: string[] = []; const adminIds: string[] = []; const vendorSessionIds: string[] = []; const promotionIds: string[] = []; const topVendorIds: string[] = [];
let checks = 0;
function pass(label: string) { checks++; console.log(`PASS ${checks}: ${label}`); }

function hashVendorJwtCookie(jwt: string): string { return createHash("sha256").update(jwt, "utf8").digest("hex"); }

async function customerCookie(customer: { id: string; email: string; name: string }) {
  const token = await encode({ secret, token: { sub: customer.id, role: "customer", sessionVersion: 0, email: customer.email, name: customer.name }, maxAge: 3600 });
  return `__Secure-next-auth.session-token.customer=${token}`;
}
async function adminCookie(admin: { id: string; email: string; name: string }) {
  const token = await encode({ secret, token: { sub: admin.id, role: "admin", email: admin.email, name: admin.name }, maxAge: 3600 });
  return `__Secure-next-auth.session-token.admin=${token}`;
}
async function vendorCookie(vendorId: string) {
  const sessionId = randomUUID();
  const jwt = await new SignJWT({ sid: sessionId }).setProtectedHeader({ alg: "HS256" }).setSubject(vendorId).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(vendorJwtSecret));
  const session = await db.vendorSession.create({ data: { id: sessionId, vendorId, tokenHash: hashVendorJwtCookie(jwt), expiresAt: new Date(Date.now() + 3600_000) } });
  vendorSessionIds.push(session.id);
  return `vendor_token=${jwt}`;
}

async function request(path: string, auth = "", method = "GET", body?: unknown, expected = 200) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(auth ? { cookie: auth } : {}), "Content-Type": "application/json", Origin: base }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: "manual" });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => "");
  assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, received ${response.status} (${isJson ? JSON.stringify(payload) : payload})`);
  return payload;
}

function futureIso(hours: number) { return new Date(Date.now() + hours * 3600_000).toISOString(); }
function pastIso(hours: number) { return new Date(Date.now() - hours * 3600_000).toISOString(); }

function promoBody(overrides: Record<string, unknown> = {}) {
  return { title: "Big Season Sale", subtitle: "Up to 40% off", desktopImage: "", mobileImage: "", ctaText: "Shop Now", ctaHref: null, placement: "HOMEPAGE_SPOTLIGHT", priority: 0, startAt: pastIso(1), endAt: futureIso(48), status: "ACTIVE", isSponsored: true, reason: "E2E fixture", ...overrides };
}

async function main() {
  await db.$queryRaw`SELECT 1`; pass("local database connection verified");

  const passwordHash = "not-a-valid-password-hash";
  const customerA = await db.customer.create({ data: { email: `${run}-a@example.invalid`, name: "Promo Test A", passwordHash, phone: "03001234567" } });
  customerIds.push(customerA.id);
  const authCustomer = await customerCookie(customerA);

  async function makeVendor(tag: string, status: "approved" | "pending" | "suspended") {
    const vendor = await db.vendor.create({ data: { shopName: `${tag} Store`, ownerName: "Vendor Owner", email: `${run}-${tag}@example.invalid`, passwordHash, phone: "03001234567", cnic: `${run}-${tag}`, address: "Test address", city: "Lahore", businessType: "individual", bankName: "Test", accountNumber: "test", accountTitle: "Test", status, storeSlug: `${run}-${tag}`, primaryCategory: "Electronics" } });
    vendorIds.push(vendor.id);
    return vendor;
  }
  const v1 = await makeVendor("v1", "approved");
  const v2 = await makeVendor("v2", "approved");
  const v3 = await makeVendor("v3", "approved"); // will be suspended mid-test
  const vPending = await makeVendor("vpending", "pending");
  const authVendor = await vendorCookie(v1.id);

  const adminOK = await db.adminUser.create({ data: { email: `${run}-admin-ok@example.invalid`, passwordHash, name: "Catalog Admin", role: "catalog", permissions: [], isActive: true } });
  const adminNoPerm = await db.adminUser.create({ data: { email: `${run}-admin-noperm@example.invalid`, passwordHash, name: "Support Admin", role: "support", permissions: [], isActive: true } });
  adminIds.push(adminOK.id, adminNoPerm.id);
  const authAdminOK = await adminCookie(adminOK); const authAdminNoPerm = await adminCookie(adminNoPerm);

  // ================= PROMOTIONS =================

  // 1: customer cannot create promotion
  await request("/api/admin/vendor-promotions", authCustomer, "POST", { vendorId: v1.id, ...promoBody() }, 401);
  pass("customer cannot create a promotion");

  // 2: vendor cannot create promotion
  await request("/api/admin/vendor-promotions", authVendor, "POST", { vendorId: v1.id, ...promoBody() }, 401);
  pass("vendor cannot create a promotion");

  // 3: unauthorized admin denied
  await request("/api/admin/vendor-promotions", authAdminNoPerm, "POST", { vendorId: v1.id, ...promoBody() }, 403);
  pass("admin without homepage.manage permission is denied");

  // 4: authorized admin creates promotion
  const create1 = await request("/api/admin/vendor-promotions", authAdminOK, "POST", { vendorId: v1.id, ...promoBody({ title: "V1 Spotlight", priority: 5 }) });
  const promo1Id: string = create1.campaign.id; promotionIds.push(promo1Id);
  assert.equal(create1.campaign.vendorId, v1.id);
  pass("authorized admin creates a promotion");

  // 5: unapproved vendor rejected
  await request("/api/admin/vendor-promotions", authAdminOK, "POST", { vendorId: vPending.id, ...promoBody() }, 400);
  pass("an unapproved vendor cannot be selected for a promotion");

  // 6-11: scheduling + priority ordering via the real homepage query
  const { activePromotions } = await import("../lib/store-service");
  const futurePromo = await request("/api/admin/vendor-promotions", authAdminOK, "POST", { vendorId: v2.id, ...promoBody({ title: "Future promo", startAt: futureIso(24), endAt: futureIso(48) }) });
  promotionIds.push(futurePromo.campaign.id);
  let active = await activePromotions();
  assert.ok(!active.some(p => p.id === futurePromo.campaign.id), "a future-scheduled promotion must not be publicly visible yet");
  pass("future promotion is hidden");

  active = await activePromotions();
  assert.ok(active.some(p => p.id === promo1Id), "an in-window, enabled, approved-vendor promotion must be visible");
  pass("active, in-window promotion is visible");

  const disableRes = await request("/api/admin/vendor-promotions", authAdminOK, "PUT", { id: promo1Id, status: "DISABLED", reason: "test disable" });
  assert.equal(disableRes.campaign.status, "DISABLED");
  active = await activePromotions();
  assert.ok(!active.some(p => p.id === promo1Id), "a disabled promotion must not be publicly visible");
  pass("disabled promotion is hidden");

  await request("/api/admin/vendor-promotions", authAdminOK, "PUT", { id: promo1Id, status: "ACTIVE", reason: "test re-enable" });

  const expiredPromo = await request("/api/admin/vendor-promotions", authAdminOK, "POST", { vendorId: v2.id, ...promoBody({ title: "Expired promo", startAt: pastIso(48), endAt: pastIso(1) }) });
  promotionIds.push(expiredPromo.campaign.id);
  active = await activePromotions();
  assert.ok(!active.some(p => p.id === expiredPromo.campaign.id), "an expired promotion must be hidden automatically");
  pass("expired promotion is hidden automatically");

  const suspendTargetPromo = await request("/api/admin/vendor-promotions", authAdminOK, "POST", { vendorId: v3.id, ...promoBody({ title: "V3 promo" }) });
  promotionIds.push(suspendTargetPromo.campaign.id);
  await db.vendor.update({ where: { id: v3.id }, data: { status: "suspended" } });
  active = await activePromotions();
  assert.ok(!active.some(p => p.id === suspendTargetPromo.campaign.id), "a promotion for a suspended vendor must be hidden immediately");
  pass("suspended vendor's promotion is hidden immediately");
  await db.vendor.update({ where: { id: v3.id }, data: { status: "approved" } });

  const highPriority = await request("/api/admin/vendor-promotions", authAdminOK, "PATCH", { id: promo1Id, vendorId: v1.id, ...promoBody({ title: "V1 Spotlight", priority: 999 }) });
  assert.equal(highPriority.campaign.priority, 999);
  active = await activePromotions();
  const idx1 = active.findIndex(p => p.id === promo1Id);
  assert.equal(idx1, 0, "highest priority promotion should be first");
  pass("priority ordering controls display order");

  // 12: mobile/desktop image correct (upload endpoint + persisted fields)
  const uploadForm = new FormData();
  uploadForm.append("file", new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" }), "banner.png");
  uploadForm.append("folder", "promotions-local");
  const uploadRes = await fetch(`${base}/api/upload`, { method: "POST", headers: { cookie: authAdminOK, Origin: base }, body: uploadForm });
  const uploadJson = (await uploadRes.json()) as { url?: string; error?: string };
  assert.equal(uploadRes.status, 200, JSON.stringify(uploadJson));
  assert.ok(uploadJson.url?.startsWith("/uploads/promotions/"), "promotion image should be stored under /uploads/promotions/");
  const withImage = await request("/api/admin/vendor-promotions", authAdminOK, "PATCH", { id: promo1Id, vendorId: v1.id, ...promoBody({ title: "V1 Spotlight", priority: 999, desktopImage: uploadJson.url, mobileImage: uploadJson.url }) });
  assert.equal(withImage.campaign.desktopImage, uploadJson.url); assert.equal(withImage.campaign.mobileImage, uploadJson.url);
  pass("desktop/mobile promotion images upload safely and persist correctly");

  const uploadFormNoAuth = new FormData();
  uploadFormNoAuth.append("file", new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), "x.png");
  uploadFormNoAuth.append("folder", "promotions-local");
  const uploadNoAuthRes = await fetch(`${base}/api/upload`, { method: "POST", headers: { Origin: base }, body: uploadFormNoAuth });
  assert.equal(uploadNoAuthRes.status, 401);
  pass("promotion image upload is rejected without an authorized admin session");

  // 13: Sponsored label vs Featured Partner (verified in the browser section below via homepage content)

  // 14: CTA safety + canonical store link
  const { promotionHref } = await import("../lib/store-service");
  const defaultHref = promotionHref({ ctaHref: null, vendor: { id: v1.id, storeSlug: v1.storeSlug } });
  assert.equal(defaultHref, `/stores/${v1.storeSlug}`);
  const customHrefRes = await request("/api/admin/vendor-promotions", authAdminOK, "PATCH", { id: promo1Id, vendorId: v1.id, ...promoBody({ title: "V1 Spotlight", priority: 999, ctaHref: "/products?category=Electronics" }) });
  assert.equal(customHrefRes.campaign.ctaHref, "/products?category=Electronics");
  const customResolved = promotionHref({ ctaHref: customHrefRes.campaign.ctaHref, vendor: { id: v1.id, storeSlug: v1.storeSlug } });
  assert.equal(customResolved, "/products?category=Electronics");
  await request("/api/admin/vendor-promotions", authAdminOK, "PATCH", { id: promo1Id, vendorId: v1.id, ...promoBody({ title: "V1 Spotlight", priority: 999, ctaHref: "javascript:alert(1)" }) }, 400);
  await request("/api/admin/vendor-promotions", authAdminOK, "PATCH", { id: promo1Id, vendorId: v1.id, ...promoBody({ title: "V1 Spotlight", priority: 999, ctaHref: "https://evil.invalid" }) }, 400);
  await request("/api/admin/vendor-promotions", authAdminOK, "PATCH", { id: promo1Id, vendorId: v1.id, ...promoBody({ title: "V1 Spotlight", priority: 999, ctaHref: null }) });
  pass("CTA prefers the canonical store page by default and strictly rejects unsafe custom destinations");

  // ================= TOP VENDORS =================

  // 15: admin adds approved vendor
  const add1 = await request("/api/admin/top-vendors", authAdminOK, "POST", { vendorId: v1.id, priority: 5, label: "", reason: "adding v1" });
  const tv1Id: string = add1.topVendor.id; topVendorIds.push(tv1Id);
  pass("admin adds an approved vendor to Top Vendors");

  // customer/vendor cannot add
  await request("/api/admin/top-vendors", authCustomer, "POST", { vendorId: v2.id, priority: 0, reason: "x" }, 401);
  await request("/api/admin/top-vendors", authVendor, "POST", { vendorId: v2.id, priority: 0, reason: "x" }, 401);
  await request("/api/admin/top-vendors", authAdminNoPerm, "POST", { vendorId: v2.id, priority: 0, reason: "x" }, 403);
  pass("only an admin with homepage.manage permission can manage Top Vendors");

  // 16: duplicate vendor cannot be added
  await request("/api/admin/top-vendors", authAdminOK, "POST", { vendorId: v1.id, priority: 1, reason: "dup" }, 409);
  pass("a vendor cannot be added to Top Vendors twice");

  // unapproved vendor rejected
  await request("/api/admin/top-vendors", authAdminOK, "POST", { vendorId: vPending.id, priority: 0, reason: "x" }, 400);
  pass("an unapproved vendor cannot be added to Top Vendors");

  // 17: priority ordering
  const add2 = await request("/api/admin/top-vendors", authAdminOK, "POST", { vendorId: v2.id, priority: 10, reason: "adding v2 higher priority" });
  const tv2Id: string = add2.topVendor.id; topVendorIds.push(tv2Id);
  const { topVendors } = await import("../lib/store-service");
  let top = await topVendors(10);
  assert.equal(top[0]?.vendor.id, v2.id, "higher priority Top Vendor should be first");
  pass("Top Vendor priority ordering works");

  // 18: disabled Top Vendor hidden
  await request("/api/admin/top-vendors", authAdminOK, "PATCH", { id: tv2Id, enabled: false, reason: "temporarily disabling" });
  top = await topVendors(10);
  assert.ok(!top.some(t => t.vendor.id === v2.id), "a disabled Top Vendor must not be publicly visible");
  pass("disabled Top Vendor is hidden");
  await request("/api/admin/top-vendors", authAdminOK, "PATCH", { id: tv2Id, enabled: true, reason: "re-enabling" });

  // 20: suspended/unapproved vendor disappears automatically, historical config preserved
  await db.vendor.update({ where: { id: v2.id }, data: { status: "suspended" } });
  top = await topVendors(10);
  assert.ok(!top.some(t => t.vendor.id === v2.id), "a suspended vendor must disappear from Top Vendors automatically");
  const adminListDuringSuspend = await request("/api/admin/top-vendors", authAdminOK);
  assert.ok(adminListDuringSuspend.topVendors.some((t: { id: string }) => t.id === tv2Id), "admin configuration must be preserved even while the vendor is suspended");
  pass("suspended vendor disappears from public Top Vendors automatically, without deleting the admin configuration");
  await db.vendor.update({ where: { id: v2.id }, data: { status: "approved" } });

  // 19: removed Top Vendor disappears (from admin list too)
  await request(`/api/admin/top-vendors?id=${encodeURIComponent(tv2Id)}&reason=${encodeURIComponent("removing v2")}`, authAdminOK, "DELETE");
  top = await topVendors(10);
  assert.ok(!top.some(t => t.vendor.id === v2.id), "a removed Top Vendor must disappear");
  const adminListAfterRemove = await request("/api/admin/top-vendors", authAdminOK);
  assert.ok(!adminListAfterRemove.topVendors.some((t: { id: string }) => t.id === tv2Id), "removed Top Vendor must not remain in the admin list");
  pass("removing a Top Vendor removes it from both the admin list and the public homepage");
  topVendorIds.splice(topVendorIds.indexOf(tv2Id), 1);

  // 21: canonical store link works
  const storePage = await request(`/stores/${v1.storeSlug}`, "");
  assert.ok(typeof storePage === "string" && storePage.includes(v1.shopName), "canonical store page should render the Top Vendor's real store");
  pass("canonical /stores/[slug] link works for a Top Vendor");

  // 22 & 23: real rating/count values only, no fake metrics
  const { vendorReviewStatsService } = await import("../lib/vendor-review-stats-service");
  const freshStats = await vendorReviewStatsService([v1.id]);
  const stat = freshStats.get(v1.id)!;
  assert.equal(stat.reviewCount, 0); assert.equal(stat.ratingAvg, 0);
  pass("a Top Vendor with no real reviews shows an honest zero/no-rating state, never a fabricated number");

  // 24 & 25: Top Vendors independent from sponsored promotions
  // v3 already has an active promotion (suspendTargetPromo, re-enabled above) but was never added to Top Vendors.
  top = await topVendors(10); active = await activePromotions();
  assert.ok(!top.some(t => t.vendor.id === v3.id), "v3 is only sponsored -- being promoted must not automatically make it a Top Vendor");
  assert.ok(active.some(p => p.vendor.id === v3.id), "sanity check: v3's promotion is indeed active");
  const bothAdd = await request("/api/admin/top-vendors", authAdminOK, "POST", { vendorId: v3.id, priority: 1, reason: "also making v3 a Top Vendor" });
  topVendorIds.push(bothAdd.topVendor.id);
  top = await topVendors(10); active = await activePromotions();
  assert.ok(top.some(t => t.vendor.id === v3.id) && active.some(p => p.vendor.id === v3.id), "a vendor may be both sponsored and a Top Vendor only when explicitly configured as both");
  pass("Top Vendors and sponsored promotions remain independent lists, combinable only by explicit admin action");

  console.log(`Fixture data before browser checks: promo=${promo1Id} v1=${v1.id} v1slug=${v1.storeSlug}`);

  // ================= BROWSER / RESPONSIVE (26) =================
  const executablePath = process.env.ACCOUNT_TEST_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext();
  await context.addCookies([{ name: "__Secure-next-auth.session-token.admin", value: authAdminOK.split("=")[1], domain: "localhost", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
  const page = await context.newPage(); const pageErrors: string[] = []; page.on("pageerror", e => pageErrors.push(e.message));

  await page.goto(`${base}/`); await page.waitForTimeout(500);
  const homeContent = await page.content();
  assert.ok(homeContent.includes("Sponsored") || homeContent.includes("Featured Partner"), "homepage must show a Sponsored/Featured Partner label, never disguise it as organic");
  assert.ok(homeContent.includes("Top Vendor") || homeContent.includes(v3.shopName), "homepage should render the Top Vendors section");
  pass("homepage shows the Sponsored/Featured Partner label and the Top Vendors section with real content");

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const url of [`${base}/`, `${base}/admin/vendor-promotions`, `${base}/admin/vendors/top-vendors`]) {
      await page.goto(url);
      await page.waitForTimeout(400);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `horizontal overflow at ${width}px on ${url}`);
    }
  }
  assert.deepEqual(pageErrors, []);
  await context.close();
  pass("homepage and both admin pages render without horizontal overflow at 360/390/768/1024/1440; no browser runtime errors");

  console.log(`PROMOTIONS/TOP VENDORS E2E PASSED: ${checks} check groups`);
}

async function cleanup() {
  await browser?.close(); server?.kill();
  const steps: [string, () => Promise<unknown>][] = [
    ["topVendor", () => db.topVendor.deleteMany({ where: { id: { in: topVendorIds } } })],
    ["vendorPromotion", () => db.vendorPromotion.deleteMany({ where: { id: { in: promotionIds } } })],
    ["marketplaceAudit", () => db.marketplaceAudit.deleteMany({ where: { target: { in: [...promotionIds, ...topVendorIds] } } })],
    ["adminAuditLog", () => db.adminAuditLog.deleteMany({ where: { entityId: { in: [...promotionIds, ...topVendorIds] } } })],
    ["vendorSession", () => db.vendorSession.deleteMany({ where: { id: { in: vendorSessionIds } } })],
    ["vendor", () => db.vendor.deleteMany({ where: { id: { in: vendorIds } } })],
    ["adminUser", () => db.adminUser.deleteMany({ where: { id: { in: adminIds } } })],
    ["customer", () => db.customer.deleteMany({ where: { id: { in: customerIds } } })],
  ];
  for (const [name, step] of steps) {
    try { await step(); } catch (error) { console.error(`cleanup step '${name}' failed:`, error instanceof Error ? error.message : error); }
  }
  await db.$disconnect();
  console.log("Temporary Promotions/Top Vendors fixtures removed; existing data untouched.");
}

server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "production", NEXTAUTH_SECRET: secret, NEXTAUTH_URL: base, NEXTAUTH_URL_INTERNAL: base, VENDOR_JWT_SECRET: vendorJwtSecret, SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_USER: "", SMTP_PASS: "", ADMIN_EMAIL: "test-admin-unused@example.invalid" } });

(async () => {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(`${base}/api/customer/profile`)).status === 401) { ready = true; break; } } catch { /* not ready yet */ }
    if (server!.exitCode !== null) throw new Error("Promotions/Top Vendors test server exited before readiness");
    await delay(1000);
  }
  assert.ok(ready, "Promotions/Top Vendors test server did not become ready");
  await main();
})().catch((error) => { console.error(error instanceof Error ? error.message : "Promotions/Top Vendors tests failed"); process.exitCode = 1; }).finally(cleanup);
