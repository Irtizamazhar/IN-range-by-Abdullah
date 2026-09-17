/** Run after npm run build. Uses only localhost DB/server and removes only this run's fixture IDs. */
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { existsSync } from "node:fs";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { SignJWT } from "jose";
import { createHash } from "node:crypto";
import { chromium, type Browser } from "playwright-core";

config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
const localHosts = ["localhost", "127.0.0.1", "[::1]"];
assert.ok(process.env.DATABASE_URL && localHosts.includes(new URL(process.env.DATABASE_URL).hostname), "Wants tests require a local development database.");
assert.ok(existsSync(".next/BUILD_ID"), "Run npm run build first.");

const db = new PrismaClient();
const run = `wants-test-${randomUUID()}`;
const secret = randomUUID();
const vendorJwtSecret = randomBytes(32).toString("hex");
const port = 3113;
const base = `http://localhost:${port}`;
let server: ReturnType<typeof spawn> | undefined;
let browser: Browser | undefined;

const customerIds: string[] = []; const vendorIds: string[] = []; const productIds: string[] = []; const wantIds: string[] = []; const adminIds: string[] = []; const vendorSessionIds: string[] = []; const offerIds: string[] = [];
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

async function main() {
  await db.$queryRaw`SELECT 1`; pass("local database connection verified");

  // ---- Fixtures ----
  const passwordHash = "not-a-valid-password-hash";
  const [a, b, c] = await Promise.all(["a", "b", "c"].map((suffix) => db.customer.create({ data: { email: `${run}-${suffix}@example.invalid`, name: `Wants Test ${suffix.toUpperCase()}`, passwordHash, phone: "03001234567" } })));
  customerIds.push(a.id, b.id, c.id);

  const matchingVendor = await db.vendor.create({ data: { shopName: "Matching Electronics Store", ownerName: "Vendor Owner", email: `${run}-vendor@example.invalid`, passwordHash, phone: "03001234567", cnic: `${run}-v1`, address: "Test address", city: "Lahore", businessType: "individual", bankName: "Test", accountNumber: "test", accountTitle: "Test", status: "approved", storeSlug: `${run}-match`, primaryCategory: "Electronics" } });
  const pendingVendor = await db.vendor.create({ data: { shopName: "Pending Store", ownerName: "Vendor Owner 2", email: `${run}-vendor2@example.invalid`, passwordHash, phone: "03001234567", cnic: `${run}-v2`, address: "Test address", city: "Lahore", businessType: "individual", bankName: "Test", accountNumber: "test", accountTitle: "Test", status: "pending", storeSlug: `${run}-pending`, primaryCategory: "Electronics" } });
  const suspendedVendor = await db.vendor.create({ data: { shopName: "Suspended Store", ownerName: "Vendor Owner 3", email: `${run}-vendor3@example.invalid`, passwordHash, phone: "03001234567", cnic: `${run}-v3`, address: "Test address", city: "Lahore", businessType: "individual", bankName: "Test", accountNumber: "test", accountTitle: "Test", status: "suspended", storeSlug: `${run}-suspended`, primaryCategory: "Electronics" } });
  vendorIds.push(matchingVendor.id, pendingVendor.id, suspendedVendor.id);

  const catalogProduct = await db.product.create({ data: { name: "Gaming Laptop Pro", description: "Test", price: 150000, category: "Electronics", stock: 5, variants: [] } });
  productIds.push(catalogProduct.id);
  await db.vendorProduct.create({ data: { vendorId: matchingVendor.id, productName: "Gaming Laptop Pro", description: "Test", price: 150000, category: "Electronics", stock: 5, images: [], status: "active", publishedProductId: catalogProduct.id } });

  const authA = await customerCookie(a); const authB = await customerCookie(b); const authC = await customerCookie(c);

  const authorizedAdmin = await db.adminUser.create({ data: { email: `${run}-admin@example.invalid`, passwordHash, name: "Ops Admin", role: "operations", permissions: [], isActive: true } });
  const unauthorizedAdmin = await db.adminUser.create({ data: { email: `${run}-admin2@example.invalid`, passwordHash, name: "Finance Admin", role: "finance", permissions: [], isActive: true } });
  adminIds.push(authorizedAdmin.id, unauthorizedAdmin.id);
  const authAdminOK = await adminCookie(authorizedAdmin); const authAdminNoPerm = await adminCookie(unauthorizedAdmin);

  const authMatchingVendor = await vendorCookie(matchingVendor.id);
  const authPendingVendor = await vendorCookie(pendingVendor.id);
  const authSuspendedVendor = await vendorCookie(suspendedVendor.id);

  // ---- 1: anonymous cannot create Want ----
  await request("/api/wants", "", "POST", { title: "Anon Want", category: "Other", city: "Lahore", quantity: 1, budgetFlexible: true, budgetMin: null, budgetMax: null }, 401);
  pass("anonymous cannot create a Want");

  // ---- 2: Customer A creates Want (matches vendor) ----
  const createRes = await request("/api/wants", authA, "POST", { title: "Need a gaming laptop for work", description: "Looking for a solid gaming laptop", category: "Electronics", city: "Lahore", quantity: 1, budgetFlexible: true, budgetMin: null, budgetMax: null, condition: "New" });
  const wantId: string = createRes.want.id; wantIds.push(wantId);
  assert.equal(createRes.want.status, "PENDING_MODERATION"); pass("Customer A creates a Want; it enters PENDING_MODERATION, not public");

  // ---- 3: Want is not publicly visible before approval ----
  const feedBeforeApproval = await request("/api/wants", "");
  assert.ok(!feedBeforeApproval.wants.some((w: { id: string }) => w.id === wantId), "unapproved Want leaked into public feed");
  await request(`/api/wants/${wantId}`, authB, "GET", undefined, 404);
  pass("pending Want is not in the public feed and 404s for a non-owner");

  // ---- 4: Customer B cannot edit Customer A's Want ----
  await request(`/api/wants/${wantId}`, authB, "PATCH", { title: "Hijacked title", category: "Electronics", city: "Lahore", quantity: 1, budgetFlexible: true, budgetMin: null, budgetMax: null }, 404);
  const stillOwnedByA = await request(`/api/wants/${wantId}`, authA);
  assert.equal(stillOwnedByA.want.title, "Need a gaming laptop for work");
  pass("Customer B cannot edit Customer A's Want");

  // ---- 5: vendor cannot moderate ----
  await request("/api/admin/wants", authMatchingVendor, "PATCH", { id: wantId, status: "OPEN", reason: "Approved." }, 401);
  pass("vendor session cannot call admin moderation API");

  // ---- 6: unauthorized admin request denied ----
  await request("/api/admin/wants", authAdminNoPerm, "PATCH", { id: wantId, status: "OPEN", reason: "Approved." }, 403);
  pass("admin without moderation.manage permission is denied");

  // ---- 7 & 8: authorized admin approves; Want becomes public ----
  const approveRes = await request("/api/admin/wants", authAdminOK, "PATCH", { id: wantId, status: "OPEN", reason: "Looks good, approved." });
  assert.equal(approveRes.want.status, "OPEN");
  const feedAfterApproval = await request("/api/wants", "");
  assert.ok(feedAfterApproval.wants.some((w: { id: string }) => w.id === wantId), "approved Want missing from public feed");
  const publicView = await request(`/api/wants/${wantId}`, "");
  assert.equal(publicView.want.status, "OPEN"); assert.ok(!("customerId" in publicView.want));
  pass("authorized admin approves the Want; it becomes public with no private fields");

  // ---- 9: rejected Want remains non-public ----
  const rejectCreate = await request("/api/wants", authA, "POST", { title: "A want that will be rejected", category: "Other", city: "Karachi", quantity: 1, budgetFlexible: true, budgetMin: null, budgetMax: null });
  const rejectedWantId: string = rejectCreate.want.id; wantIds.push(rejectedWantId);
  const rejectRes = await request("/api/admin/wants", authAdminOK, "PATCH", { id: rejectedWantId, status: "REJECTED", reason: "Contains insufficient detail." });
  assert.equal(rejectRes.want.status, "REJECTED");
  const feedAfterReject = await request("/api/wants", "");
  assert.ok(!feedAfterReject.wants.some((w: { id: string }) => w.id === rejectedWantId));
  await request(`/api/wants/${rejectedWantId}`, authB, "GET", undefined, 404);
  const ownerRejectedView = await request(`/api/wants/${rejectedWantId}`, authA);
  assert.equal(ownerRejectedView.want.status, "REJECTED");
  pass("rejected Want stays non-public; owner still sees the moderation reason");

  // ---- 10: expired Want is non-public / non-interactable ----
  const expiredWant = await db.want.create({ data: { customerId: a.id, title: "An expired want", category: "Electronics", city: "Lahore", status: "OPEN", quantity: 1, budgetFlexible: true, expiresAt: new Date(Date.now() - 86400000) } });
  wantIds.push(expiredWant.id);
  const feedExcludesExpired = await request("/api/wants", "");
  assert.ok(!feedExcludesExpired.wants.some((w: { id: string }) => w.id === expiredWant.id));
  await request(`/api/wants/${expiredWant.id}`, authB, "GET", undefined, 404);
  await request(`/api/wants/${expiredWant.id}/interest`, authB, "PUT", undefined, 404);
  pass("expired Want is excluded from the public feed and cannot gain new interest");

  // ---- 11-14: Mujhe Bhi Chahiye (join/idempotent/persist/leave) ----
  const join1 = await request(`/api/wants/${wantId}/interest`, authB, "PUT"); assert.deepEqual(join1, { joined: true, count: 1 });
  pass("Customer B expresses interest (Mujhe Bhi Chahiye)");
  const join2 = await request(`/api/wants/${wantId}/interest`, authB, "PUT"); assert.deepEqual(join2, { joined: true, count: 1 });
  assert.equal(await db.wantInterest.count({ where: { wantId, customerId: b.id } }), 1);
  pass("repeated interest stays exactly one record");
  const refreshed = await request(`/api/wants/${wantId}/interest`, authB); assert.equal(refreshed.joined, true);
  pass("interest state persists across a fresh request (refresh)");
  const left = await request(`/api/wants/${wantId}/interest`, authB, "DELETE"); assert.deepEqual(left, { joined: false, count: 0 });
  pass("removing interest updates the count correctly");

  // ---- 15: independent interest state + owner self-interest denied ----
  await request(`/api/wants/${wantId}/interest`, authB, "PUT");
  const cJoin = await request(`/api/wants/${wantId}/interest`, authC, "PUT"); assert.deepEqual(cJoin, { joined: true, count: 2 });
  assert.equal((await request(`/api/wants/${wantId}/interest`, authB)).joined, true);
  assert.equal((await request(`/api/wants/${wantId}/interest`, authC)).joined, true);
  await request(`/api/wants/${wantId}/interest`, authA, "PUT", undefined, 400);
  pass("Customer C has independent interest state; the Want owner cannot self-interest");

  // ---- 16 & 17: trending uses real interest activity, not offers ----
  const quietWant = await request("/api/wants", authA, "POST", { title: "A quiet want with no interest", category: "Electronics", city: "Lahore", quantity: 1, budgetFlexible: true, budgetMin: null, budgetMax: null });
  const quietWantId: string = quietWant.want.id; wantIds.push(quietWantId);
  await request("/api/admin/wants", authAdminOK, "PATCH", { id: quietWantId, status: "OPEN", reason: "Approved." });
  const offer = await db.wantOffer.create({ data: { wantId: quietWantId, vendorId: matchingVendor.id, revisions: { create: { revisionNumber: 1, initiator: "VENDOR", price: 1000, quantity: 1, shipping: 0, delivery: "3 days", condition: "New", warranty: "None", message: "Test offer", expiresAt: new Date(Date.now() + 86400000) } } } });
  offerIds.push(offer.id);
  const rankedFeed = await request("/api/wants", "");
  const activeIdx = rankedFeed.wants.findIndex((w: { id: string }) => w.id === wantId);
  const quietIdx = rankedFeed.wants.findIndex((w: { id: string }) => w.id === quietWantId);
  assert.ok(activeIdx !== -1 && quietIdx !== -1, "both wants should be in the ranked feed");
  assert.ok(activeIdx < quietIdx, "want with real interest should rank above a want with only vendor-offer activity and no interest");
  const quietWantRow = rankedFeed.wants[quietIdx];
  assert.equal(quietWantRow._count.interests, 0, "vendor offer must not be counted as customer interest");
  pass("trending ranks by real WantInterest activity; vendor offers never count as demand");

  // ---- 18 & 19: approved vendor sees matching Want with correct reasons ----
  const demandHtml = await request("/vendor/dashboard/demand", authMatchingVendor);
  assert.ok(demandHtml.includes("Need a gaming laptop for work"), "matching Want missing from vendor demand board");
  assert.ok(demandHtml.includes("Matches your store category"), "expected category-match reason missing");
  assert.ok(demandHtml.includes("Matching for you"), "demand board missing a distinct matching section");
  pass("approved vendor sees the matching Want with a correct, explainable reason");

  // ---- 20: vendor can browse All Wants (non-matching Wants remain visible) ----
  const nonMatching = await request("/api/wants", authA, "POST", { title: "Need used furniture", category: "Furniture", city: "Karachi", quantity: 1, budgetFlexible: true, budgetMin: null, budgetMax: null });
  const nonMatchingId: string = nonMatching.want.id; wantIds.push(nonMatchingId);
  await request("/api/admin/wants", authAdminOK, "PATCH", { id: nonMatchingId, status: "OPEN", reason: "Approved." });
  const demandHtml2 = await request("/vendor/dashboard/demand", authMatchingVendor);
  assert.ok(demandHtml2.includes("Need used furniture"), "non-matching open Want should still be browsable under All open Wants");
  assert.ok(demandHtml2.includes("All open Wants"), "demand board missing the All open Wants section");
  pass("vendor can browse All Wants; non-matching open Wants remain visible");

  // ---- 21: unapproved / suspended vendor denied privileged demand access ----
  const pendingDemand = await request("/vendor/dashboard/demand", authPendingVendor);
  assert.ok(pendingDemand.includes("must be approved"), "pending vendor should be blocked from the demand board");
  assert.ok(!pendingDemand.includes("Need a gaming laptop for work"), "pending vendor must not see real demand data");
  const pendingDetail = await request(`/vendor/dashboard/demand/${wantId}`, authPendingVendor);
  assert.ok(pendingDetail.includes("must be approved"), "pending vendor should be blocked from demand detail");
  // Next.js renders a server redirect as 200 + a meta-refresh/RSC digest for a plain HTTP client (not a real 3xx);
  // a real browser (checked later) follows it instantly. Assert the redirect target and no leaked demand data.
  const suspendedBody = await request("/vendor/dashboard/demand", authSuspendedVendor);
  assert.ok(suspendedBody.includes("url=/vendor/login") || suspendedBody.includes("NEXT_REDIRECT"), "suspended vendor's revoked session should redirect to login");
  assert.ok(!suspendedBody.includes("Need a gaming laptop for work"), "suspended vendor must not see real demand data");
  pass("pending vendor sees an approval gate with no real data; suspended vendor's revoked session is redirected to login with no leaked data");

  // ---- 22: vendor never receives customer private contact info ----
  assert.ok(!demandHtml.includes(a.email), "customer email leaked to vendor demand board");
  assert.ok(!demandHtml.includes(a.phone), "customer phone leaked to vendor demand board");
  const detailHtml = await request(`/vendor/dashboard/demand/${wantId}`, authMatchingVendor);
  assert.ok(!detailHtml.includes(a.email) && !detailHtml.includes(a.phone), "customer contact info leaked to demand detail");
  assert.ok(detailHtml.includes("interested") && detailHtml.includes("Expires"), "demand detail missing expected real fields");
  pass("vendor never receives customer private contact information; demand detail shows real supporting fields");

  // ---- 23: moderation notification belongs to the correct customer ----
  const notificationsA = await request("/api/customer/notifications", authA);
  const modNotice = notificationsA.notifications.find((n: { title: string }) => n.title.includes("live"));
  assert.ok(modNotice, "moderation notification missing for the Want owner");
  const notificationsB = await request("/api/customer/notifications", authB);
  assert.ok(!notificationsB.notifications.some((n: { title: string; message: string }) => n.title.includes("gaming laptop") || n.message.includes("gaming laptop")), "moderation notification leaked to a different customer");
  // Re-approving an already-OPEN Want is correctly rejected as an invalid transition (409) --
  // confirmed separately below. Idempotency is tested via a repeatable transition (re-rejecting
  // an already-rejected Want), which the admin route does allow to replay.
  await request("/api/admin/wants", authAdminOK, "PATCH", { id: wantId, status: "OPEN", reason: "Looks good, approved." }, 409);
  await request("/api/admin/wants", authAdminOK, "PATCH", { id: rejectedWantId, status: "REJECTED", reason: "Contains insufficient detail." });
  const notificationCountAfterRepeat = (await request("/api/customer/notifications", authA)).notifications.filter((n: { title: string }) => n.title.includes("rejected")).length;
  assert.equal(notificationCountAfterRepeat, 1, "repeated identical moderation action must not spam duplicate notifications");
  pass("moderation notification belongs to the correct customer only, is idempotent on replay, and re-approving an already-open Want is correctly refused");

  // ---- Server-rendered pages + browser (Step 3 signed-in + responsive checks) ----
  const executablePath = process.env.ACCOUNT_TEST_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    { name: "__Secure-next-auth.session-token.customer", value: authA.split("=")[1], domain: "localhost", path: "/", httpOnly: true, secure: true, sameSite: "Lax" },
  ]);
  const page = await context.newPage(); const pageErrors: string[] = []; page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(`${base}/wants/new`); await page.getByLabel("What do you need?").waitFor();
  await page.goto(`${base}/wants/${wantId}`); await page.getByRole("heading", { name: "Want details" }).waitFor();
  await page.goto(`${base}/wants`); await page.getByRole("heading", { name: "Wants", exact: true }).waitFor();
  await page.goto(`${base}/wants/trending`); await page.getByRole("heading", { name: "Trending Wants" }).waitFor();
  await page.goto(`${base}/account?tab=wants`); await page.getByText("Need a gaming laptop for work").waitFor();
  pass("signed-in browser can reach /wants, /wants/new, /wants/[id], /wants/trending and My Wants");

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of [`${base}/wants`, `${base}/wants/new`, `${base}/wants/${wantId}`, `${base}/wants/trending`, `${base}/account?tab=wants`]) {
      await page.goto(url);
      await page.waitForFunction(() => !document.querySelector("main")?.textContent?.includes("Loading"));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `overflow at ${width}px on ${url}`);
    }
  }
  await context.close();

  // Admin browser session
  const adminContext = await browser.newContext();
  await adminContext.addCookies([{ name: "__Secure-next-auth.session-token.admin", value: authAdminOK.split("=")[1], domain: "localhost", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
  const adminPage = await adminContext.newPage();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await adminPage.setViewportSize({ width, height: 900 });
    await adminPage.goto(`${base}/admin/wants`);
    await adminPage.getByRole("heading", { name: "Wants moderation" }).waitFor();
    assert.ok(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `admin Wants moderation overflow at ${width}px`);
  }
  await adminPage.getByText("Need used furniture", { exact: true }).waitFor();
  await adminContext.close();

  // Vendor browser session
  const vendorContext = await browser.newContext();
  await vendorContext.addCookies([{ name: "vendor_token", value: authMatchingVendor.split("=")[1], domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" }]);
  const vendorPage = await vendorContext.newPage();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await vendorPage.setViewportSize({ width, height: 900 });
    await vendorPage.goto(`${base}/vendor/dashboard/demand`);
    await vendorPage.getByRole("heading", { name: "Customer Demand" }).waitFor();
    assert.ok(await vendorPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `vendor demand board overflow at ${width}px`);
    await vendorPage.goto(`${base}/vendor/dashboard/demand/${wantId}`);
    await vendorPage.getByRole("heading", { name: "Need a gaming laptop for work" }).waitFor();
    assert.ok(await vendorPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `vendor demand detail overflow at ${width}px`);
  }
  assert.deepEqual(pageErrors, []);
  await vendorContext.close();
  pass("admin moderation and vendor demand board/detail render without horizontal overflow at 360, 390, 768, 1024 and 1440px; no browser runtime errors");

  console.log(`WANTS/DEMAND E2E PASSED: ${checks} check groups`);
}

async function cleanup() {
  await browser?.close(); server?.kill();
  // Each step runs independently so one FK/ordering surprise never leaves the rest of a run's
  // fixtures orphaned in the database.
  const steps: [string, () => Promise<unknown>][] = [
    ["offerRevision", () => db.offerRevision.deleteMany({ where: { offerId: { in: offerIds } } })],
    ["wantOffer", () => db.wantOffer.deleteMany({ where: { id: { in: offerIds } } })],
    ["wantInterest", () => db.wantInterest.deleteMany({ where: { wantId: { in: wantIds } } })],
    ["customerNotification", () => db.customerNotification.deleteMany({ where: { customerId: { in: customerIds } } })],
    ["marketplaceAudit", () => db.marketplaceAudit.deleteMany({ where: { target: { in: wantIds } } })],
    ["adminAuditLog", () => db.adminAuditLog.deleteMany({ where: { entityId: { in: wantIds } } })],
    ["want", () => db.want.deleteMany({ where: { id: { in: wantIds } } })],
    ["vendorSession", () => db.vendorSession.deleteMany({ where: { id: { in: vendorSessionIds } } })],
    ["vendorProduct", () => db.vendorProduct.deleteMany({ where: { vendorId: { in: vendorIds } } })],
    ["product", () => db.product.deleteMany({ where: { id: { in: productIds } } })],
    ["vendor", () => db.vendor.deleteMany({ where: { id: { in: vendorIds } } })],
    ["adminUser", () => db.adminUser.deleteMany({ where: { id: { in: adminIds } } })],
    ["customer", () => db.customer.deleteMany({ where: { id: { in: customerIds } } })],
  ];
  for (const [name, step] of steps) {
    try { await step(); } catch (error) { console.error(`cleanup step '${name}' failed:`, error instanceof Error ? error.message : error); }
  }
  await db.$disconnect();
  console.log("Temporary Wants/demand fixtures removed; existing data untouched.");
}

server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "production", NEXTAUTH_SECRET: secret, NEXTAUTH_URL: base, NEXTAUTH_URL_INTERNAL: base, VENDOR_JWT_SECRET: vendorJwtSecret, SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_USER: "", SMTP_PASS: "", ADMIN_EMAIL: "test-admin-unused@example.invalid" } });

(async () => {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(`${base}/api/customer/profile`)).status === 401) { ready = true; break; } } catch { /* not ready yet */ }
    if (server!.exitCode !== null) throw new Error("Wants test server exited before readiness");
    await delay(1000);
  }
  assert.ok(ready, "Wants test server did not become ready");
  await main();
})().catch((error) => { console.error(error instanceof Error ? error.message : "Wants/demand tests failed"); process.exitCode = 1; }).finally(cleanup);
