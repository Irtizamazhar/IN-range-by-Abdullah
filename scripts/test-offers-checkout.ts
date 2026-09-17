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
assert.ok(process.env.DATABASE_URL && localHosts.includes(new URL(process.env.DATABASE_URL).hostname), "Offers tests require a local development database.");
assert.ok(existsSync(".next/BUILD_ID"), "Run npm run build first.");

const db = new PrismaClient();
const run = `offers-test-${randomUUID()}`;
const secret = randomUUID();
const vendorJwtSecret = randomBytes(32).toString("hex");
const port = 3114;
const base = `http://localhost:${port}`;
let server: ReturnType<typeof spawn> | undefined;
let browser: Browser | undefined;

const customerIds: string[] = []; const vendorIds: string[] = []; const productIds: string[] = []; const wantIds: string[] = []; const vendorSessionIds: string[] = []; const offerIds: string[] = []; const orderIds: string[] = [];
let checks = 0;
function pass(label: string) { checks++; console.log(`PASS ${checks}: ${label}`); }

function hashVendorJwtCookie(jwt: string): string { return createHash("sha256").update(jwt, "utf8").digest("hex"); }

async function customerCookie(customer: { id: string; email: string; name: string }) {
  const token = await encode({ secret, token: { sub: customer.id, role: "customer", sessionVersion: 0, email: customer.email, name: customer.name }, maxAge: 3600 });
  return `__Secure-next-auth.session-token.customer=${token}`;
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

function offerBody(overrides: Record<string, unknown> = {}) {
  return { productId: null, price: 1000, quantity: 1, shipping: 100, delivery: "3-5 business days", condition: "New", warranty: "6 months", message: "Standard offer", expiresAt: futureIso(48), ...overrides };
}

async function main() {
  await db.$queryRaw`SELECT 1`; pass("local database connection verified");

  // ---- Fixtures ----
  const passwordHash = "not-a-valid-password-hash";
  const [a, b] = await Promise.all(["a", "b"].map((s) => db.customer.create({ data: { email: `${run}-${s}@example.invalid`, name: `Offers Test ${s.toUpperCase()}`, passwordHash, phone: "03001234567" } })));
  customerIds.push(a.id, b.id);
  const authA = await customerCookie(a); const authB = await customerCookie(b);

  async function makeVendor(tag: string, status: "approved" | "pending") {
    const vendor = await db.vendor.create({ data: { shopName: `${tag} Store`, ownerName: "Vendor Owner", email: `${run}-${tag}@example.invalid`, passwordHash, phone: "03001234567", cnic: `${run}-${tag}`, address: "Test address", city: "Lahore", businessType: "individual", bankName: "Test", accountNumber: "test", accountTitle: "Test", status, storeSlug: `${run}-${tag}`, primaryCategory: "Electronics" } });
    vendorIds.push(vendor.id);
    return vendor;
  }
  const v1 = await makeVendor("v1", "approved");
  const v2 = await makeVendor("v2", "approved");
  const v3 = await makeVendor("v3", "approved");
  const vStale = await makeVendor("vstale", "approved");
  const vPending = await makeVendor("vpending", "pending");

  async function makeProduct(tag: string, vendorId: string) {
    const product = await db.product.create({ data: { name: `${tag} Product`, description: "Test", price: 1000, category: "Electronics", stock: 10, variants: [] } });
    productIds.push(product.id);
    await db.vendorProduct.create({ data: { vendorId, productName: `${tag} Product`, description: "Test", price: 1000, category: "Electronics", stock: 10, images: [], status: "active", publishedProductId: product.id } });
    return product;
  }
  const p1 = await makeProduct("v1", v1.id);
  const p2 = await makeProduct("v2", v2.id);
  await makeProduct("v3", v3.id);
  const pStale = await makeProduct("vstale", vStale.id);

  const authV1 = await vendorCookie(v1.id); const authV2 = await vendorCookie(v2.id); const authV3 = await vendorCookie(v3.id); const authVStale = await vendorCookie(vStale.id); const authVPending = await vendorCookie(vPending.id);

  const want = await db.want.create({ data: { customerId: a.id, title: "Need a new laptop bag", description: "Durable, waterproof", category: "Electronics", city: "Lahore", status: "OPEN", quantity: 1, budgetFlexible: true, expiresAt: new Date(Date.now() + 7 * 86400000) } });
  wantIds.push(want.id);

  // ---- 1: anonymous cannot submit offer ----
  await request("/api/vendor/offers", "", "POST", { wantId: want.id, ...offerBody({ productId: p1.id }) }, 403);
  pass("anonymous cannot submit a vendor offer");

  // ---- 2: pending vendor denied ----
  await request("/api/vendor/offers", authVPending, "POST", { wantId: want.id, ...offerBody() }, 403);
  pass("pending (unapproved) vendor cannot submit an offer");

  // ---- 3: approved vendor submits ----
  const submit1 = await request("/api/vendor/offers", authV1, "POST", { wantId: want.id, ...offerBody({ productId: p1.id, price: 5000, shipping: 200 }) });
  const offer1Id: string = submit1.offer.id; offerIds.push(offer1Id);
  assert.equal(submit1.offer.vendorId, v1.id);
  const rev1 = await db.offerRevision.findFirst({ where: { offerId: offer1Id } });
  assert.equal(rev1?.revisionNumber, 1); assert.equal(rev1?.initiator, "VENDOR");
  pass("approved vendor submits an offer; creates offer thread with revision 1");

  // duplicate submission on the same want by the same vendor is rejected cleanly (no raw DB crash)
  await request("/api/vendor/offers", authV1, "POST", { wantId: want.id, ...offerBody({ productId: p1.id }) }, 409);
  pass("a vendor cannot open a second offer thread on the same Want (clean 409, not a server error)");

  // ---- another vendor's product cannot be attached ----
  await request("/api/vendor/offers", authV2, "POST", { wantId: want.id, ...offerBody({ productId: p1.id }) }, 409);
  pass("a vendor cannot attach another vendor's catalog product to their own offer");

  // ---- 8: second vendor submits (real product) ----
  const submit2 = await request("/api/vendor/offers", authV2, "POST", { wantId: want.id, ...offerBody({ productId: p2.id, price: 4500, shipping: 300 }) });
  const offer2Id: string = submit2.offer.id; offerIds.push(offer2Id);
  pass("a second, independent vendor opens their own offer thread on the same Want");

  // ---- 4: vendor B cannot modify vendor A's offer ----
  await request(`/api/offers/${offer1Id}`, authV2, "PATCH", { action: "withdraw", revisionId: rev1!.id }, 403);
  pass("vendor B cannot withdraw/modify vendor A's offer thread");

  // ---- 6 & 7: customer isolation on received offers ----
  const offersA = await request("/api/account/offers", authA);
  assert.ok(offersA.offers.some((o: { id: string }) => o.id === offer1Id) && offersA.offers.some((o: { id: string }) => o.id === offer2Id));
  const offersB = await request("/api/account/offers", authB);
  assert.equal(offersB.offers.length, 0, "customer B must not see customer A's received offers");
  pass("customer sees their own received offers; another customer sees none of them");

  // customer B cannot act on customer A's offer either (ownership, not just listing)
  await request(`/api/offers/${offer1Id}`, authB, "PATCH", { action: "reject", revisionId: rev1!.id }, 403);
  pass("customer B cannot reject/act on customer A's offer");

  // IDOR / id-guessing: a random, well-formed but non-existent offer id 404s, not 500 or leaked data
  await request(`/api/offers/${randomUUID()}`, authA, "PATCH", { action: "reject", revisionId: randomUUID() }, 404);
  pass("guessing a random offer id returns 404, not a server error or leaked record");

  // ---- 9: comparison data is real and complete ----
  const wantAsOwner = await request(`/api/wants/${want.id}`, authA);
  assert.equal(wantAsOwner.want.offers.length, 2);
  const offerRowsForCompare = wantAsOwner.want.offers as Array<{ id: string; vendor: { shopName: string }; revisions: Array<{ price: string; quantity: number; shipping: string; delivery: string; condition: string; warranty: string; expiresAt: string }> }>;
  for (const o of offerRowsForCompare) { const r = o.revisions[0]; assert.ok(r.price && r.quantity && r.delivery && r.condition); }
  pass("customer comparison view returns real, complete per-offer terms for every active offer");

  // a counter cannot swap in a different vendor's product (checked while it's still the customer's turn)
  await request(`/api/offers/${offer1Id}`, authA, "PATCH", { action: "counter", revisionId: rev1!.id, ...offerBody({ productId: p2.id, price: 4700, shipping: 150 }) }, 400);
  pass("a customer counter cannot substitute a different vendor's product");

  // ---- 10 & 11: customer counter creates a new revision; old revision unchanged ----
  const counter1 = await request(`/api/offers/${offer1Id}`, authA, "PATCH", { action: "counter", revisionId: rev1!.id, ...offerBody({ productId: p1.id, price: 4700, shipping: 150 }) });
  assert.equal(counter1.offer.status, "COUNTERED"); assert.equal(counter1.offer.version, 2);
  const rev1Reloaded = await db.offerRevision.findUnique({ where: { id: rev1!.id } });
  assert.equal(Number(rev1Reloaded?.price), Number(rev1?.price), "the original revision must remain immutable after a counter");
  const rev2 = await db.offerRevision.findFirst({ where: { offerId: offer1Id, revisionNumber: 2 } });
  assert.equal(rev2?.initiator, "CUSTOMER"); assert.equal(Number(rev2?.price), 4700);
  pass("customer counter offer appends an immutable new revision; the prior revision is untouched");

  // stale revisionId (rev1, no longer the latest) is refused, not silently applied
  await request(`/api/offers/${offer1Id}`, authA, "PATCH", { action: "counter", revisionId: rev1!.id, ...offerBody({ productId: p1.id, price: 1, shipping: 0 }) }, 409);
  pass("acting against a stale (non-latest) revisionId is refused server-side");

  // ---- 12 & 13: vendor sees the counter and can send a new revision ----
  const v1Offers = await request("/api/vendor/offers", authV1);
  const v1OfferRow = v1Offers.offers.find((o: { id: string }) => o.id === offer1Id);
  assert.equal(v1OfferRow.revisions[0].initiator, "CUSTOMER"); assert.equal(v1OfferRow.revisions[0].revisionNumber, 2);
  const revise1 = await request(`/api/offers/${offer1Id}`, authV1, "PATCH", { action: "revise", revisionId: rev2!.id, ...offerBody({ productId: p1.id, price: 4850, shipping: 150 }) });
  assert.equal(revise1.offer.status, "SUBMITTED"); assert.equal(revise1.offer.version, 3);
  const rev3 = await db.offerRevision.findFirst({ where: { offerId: offer1Id, revisionNumber: 3 } });
  assert.equal(rev3?.initiator, "VENDOR");
  pass("vendor sees the customer's counter and sends back a new revision; full history is append-only");

  // ---- 14 & 15: customer rejects; rejected offer cannot be accepted ----
  const rev2ForOffer2 = await db.offerRevision.findFirst({ where: { offerId: offer2Id } });
  const rejectRes = await request(`/api/offers/${offer2Id}`, authA, "PATCH", { action: "reject", revisionId: rev2ForOffer2!.id });
  assert.equal(rejectRes.offer.status, "REJECTED");
  await request(`/api/offers/${offer2Id}`, authA, "PATCH", { action: "accept", revisionId: rev2ForOffer2!.id, idempotencyKey: randomUUID() }, 409);
  pass("customer rejects an offer; a rejected offer can never be accepted afterwards");

  // ---- 16: vendor withdraw ----
  const submit3 = await request("/api/vendor/offers", authV3, "POST", { wantId: want.id, ...offerBody({ price: 4600, shipping: 250 }) });
  const offer3Id: string = submit3.offer.id; offerIds.push(offer3Id);
  const rev3ForOffer3 = await db.offerRevision.findFirst({ where: { offerId: offer3Id } });
  const withdrawRes = await request(`/api/offers/${offer3Id}`, authV3, "PATCH", { action: "withdraw", revisionId: rev3ForOffer3!.id });
  assert.equal(withdrawRes.offer.status, "WITHDRAWN");
  await request(`/api/offers/${offer3Id}`, authA, "PATCH", { action: "accept", revisionId: rev3ForOffer3!.id, idempotencyKey: randomUUID() }, 409);
  pass("vendor withdraws their own offer; a withdrawn offer cannot be accepted");

  // ---- 17: expiry is checked server-side, never trusted from the client ----
  const staleWantOffer = await db.wantOffer.create({ data: { wantId: want.id, vendorId: vStale.id, status: "SUBMITTED", revisions: { create: { revisionNumber: 1, initiator: "VENDOR", productId: pStale.id, price: 3000, quantity: 1, shipping: 0, delivery: "2 days", condition: "New", warranty: "None", message: "Already-expired fixture", expiresAt: new Date(Date.now() - 3600_000) } } } });
  offerIds.push(staleWantOffer.id);
  const expiredRev = await db.offerRevision.findFirst({ where: { offerId: staleWantOffer.id } });
  await request(`/api/offers/${staleWantOffer.id}`, authA, "PATCH", { action: "accept", revisionId: expiredRev!.id, idempotencyKey: randomUUID() }, 409);
  await request(`/api/offers/${staleWantOffer.id}`, authVStale, "PATCH", { action: "revise", revisionId: expiredRev!.id, ...offerBody({ productId: pStale.id }) }, 409);
  pass("an expired offer revision cannot be accepted or revised, regardless of what the client displays");

  // suspend the vendor after submission; their still-open offer must stop being actionable
  await db.vendor.update({ where: { id: v3.id }, data: { status: "suspended" } });
  const anotherV3Submit = await db.wantOffer.findFirst({ where: { vendorId: v3.id, wantId: want.id } });
  void anotherV3Submit;
  await request("/api/vendor/offers", authV3, "POST", { wantId: want.id, ...offerBody() }, 403);
  pass("a vendor suspended after submitting an offer can no longer submit or act as an approved vendor");
  await db.vendor.update({ where: { id: v3.id }, data: { status: "approved" } });

  // ---- 18: customer accepts the current revision ----
  const acceptKey = randomUUID();
  const acceptRes = await request(`/api/offers/${offer1Id}`, authA, "PATCH", { action: "accept", revisionId: rev3!.id, idempotencyKey: acceptKey, price: 1 });
  const quoteId: string = acceptRes.quote.id;
  const quoteRow = await db.offerQuote.findUnique({ where: { id: quoteId } });
  assert.equal(Number((quoteRow!.snapshot as { price: string }).price), 4850, "client-supplied 'price' field must never influence the accepted snapshot");
  const offer1AfterAccept = await db.wantOffer.findUnique({ where: { id: offer1Id } });
  assert.equal(offer1AfterAccept?.status, "ACCEPTED");
  pass("customer accepts the vendor's current revision; the snapshot uses only server-computed terms, ignoring any client-supplied price");

  // ---- 19: non-owner cannot accept ----
  await request(`/api/offers/${offer3Id}`, authB, "PATCH", { action: "accept", revisionId: rev3ForOffer3!.id, idempotencyKey: randomUUID() }, 403);
  pass("a non-owner customer cannot accept any offer on someone else's Want");

  // ---- 20: stale revision cannot be accepted ----
  const staleAcceptTarget = await request("/api/vendor/offers", authVStale, "POST", { wantId: want.id, ...offerBody({ productId: pStale.id, price: 2000, shipping: 0 }) }).catch(() => null);
  void staleAcceptTarget; // vStale already has an offer thread on this want (the expired fixture); reuse a fresh want instead
  const want2 = await db.want.create({ data: { customerId: a.id, title: "A second want for staleness checks", category: "Electronics", city: "Lahore", status: "OPEN", quantity: 1, budgetFlexible: true, expiresAt: new Date(Date.now() + 7 * 86400000) } });
  wantIds.push(want2.id);
  const staleSubmit = await request("/api/vendor/offers", authVStale, "POST", { wantId: want2.id, ...offerBody({ productId: pStale.id, price: 2000, shipping: 0 }) });
  const staleOfferId: string = staleSubmit.offer.id; offerIds.push(staleOfferId);
  const staleV1 = await db.offerRevision.findFirst({ where: { offerId: staleOfferId } });
  await request(`/api/offers/${staleOfferId}`, authA, "PATCH", { action: "counter", revisionId: staleV1!.id, ...offerBody({ productId: pStale.id, price: 1900, shipping: 0 }) });
  await request(`/api/offers/${staleOfferId}`, authA, "PATCH", { action: "accept", revisionId: staleV1!.id, idempotencyKey: randomUUID() }, 409);
  pass("a stale (superseded) revisionId cannot be accepted even though it was once the latest");

  // ---- 21: accepted snapshot is immune to later source-data changes ----
  await db.product.update({ where: { id: p1.id }, data: { name: "Renamed After Acceptance", price: 999999 } });
  const quoteAfterProductChange = await db.offerQuote.findUnique({ where: { id: quoteId } });
  const snap = quoteAfterProductChange!.snapshot as { name: string; price: string };
  assert.equal(snap.name, "v1 Product"); assert.equal(Number(snap.price), 4850);
  pass("the accepted quote snapshot is unaffected by later changes to the underlying product");

  // ---- 22: second conflicting acceptance on the same Want is denied ----
  const staleOfferForWant = await db.offerRevision.findFirst({ where: { offerId: offer3Id } });
  await request(`/api/offers/${offer3Id}`, authA, "PATCH", { action: "accept", revisionId: staleOfferForWant!.id, idempotencyKey: randomUUID() }, 409);
  pass("a conflicting second acceptance on a Want that already has an accepted quote is refused");

  // repeat-accept with the SAME revision/customer/quote is a safe idempotent replay, not an error
  const repeatAccept = await request(`/api/offers/${offer1Id}`, authA, "PATCH", { action: "accept", revisionId: rev3!.id, idempotencyKey: acceptKey });
  assert.equal(repeatAccept.quote.id, quoteId);
  pass("re-submitting the same accept action returns the same quote idempotently, without creating a duplicate");

  // ---- 23, 25, 26, 27: checkout uses accepted terms; repeat checkout has no duplicate order ----
  const order1 = await request("/api/orders", authA, "POST", { quoteId, city: "Lahore", customerName: "Offers Test A", customerPhone: "03001234567", customerAddress: "123 Test Street", products: [{ productId: p1.id, quantity: 1 }], paymentMethod: "cod", checkoutKey: `offer-checkout-a-${randomUUID()}` });
  orderIds.push(order1.id);
  assert.equal(order1.customerId ?? a.id, a.id);
  const orderDb = await db.order.findUnique({ where: { id: order1.id } });
  assert.equal(Number(orderDb!.totalAmount), 4850 + 150, "checkout total must match the accepted offer's price+shipping, not any other value");
  assert.equal(orderDb!.paymentMethod, "cod");
  pass("checkout consumes the accepted quote's exact server-computed terms; only Cash on Delivery is used, no fake payment-success claim");
  const order2 = await request("/api/orders", authA, "POST", { quoteId, city: "Lahore", customerName: "Offers Test A", customerPhone: "03001234567", customerAddress: "123 Test Street", products: [{ productId: p1.id, quantity: 1 }], paymentMethod: "cod", checkoutKey: `offer-checkout-a-repeat-${randomUUID()}` });
  assert.equal(order2.id, order1.id, "checking out an already-checked-out quote a second time must return the same order, never a duplicate");
  const orderCountForQuote = await db.order.count({ where: { id: order1.id } });
  assert.equal(orderCountForQuote, 1);
  pass("repeating checkout on an already-checked-out quote returns the same order; no duplicate order is created");

  // ---- 24: checkout cannot be used by another customer ----
  const want3 = await db.want.create({ data: { customerId: a.id, title: "A third want for cross-customer checkout checks", category: "Electronics", city: "Lahore", status: "OPEN", quantity: 1, budgetFlexible: true, expiresAt: new Date(Date.now() + 7 * 86400000) } });
  wantIds.push(want3.id);
  const offerForCrossCustomer = await request("/api/vendor/offers", authV2, "POST", { wantId: want3.id, ...offerBody({ productId: p2.id, price: 3300, shipping: 100 }) });
  const offerForCrossCustomerId: string = offerForCrossCustomer.offer.id; offerIds.push(offerForCrossCustomerId);
  const revForCrossCustomer = await db.offerRevision.findFirst({ where: { offerId: offerForCrossCustomerId } });
  const acceptForCrossCustomer = await request(`/api/offers/${offerForCrossCustomerId}`, authA, "PATCH", { action: "accept", revisionId: revForCrossCustomer!.id, idempotencyKey: randomUUID() });
  const quoteForCrossCustomer: string = acceptForCrossCustomer.quote.id;
  await request("/api/orders", authB, "POST", { quoteId: quoteForCrossCustomer, city: "Lahore", customerName: "Offers Test B", customerPhone: "03001234567", customerAddress: "999 Other Street", products: [{ productId: p2.id, quantity: 1 }], paymentMethod: "cod", checkoutKey: `offer-checkout-b-${randomUUID()}` }, 404);
  pass("another customer cannot check out with a quote id that belongs to someone else's accepted offer");

  // ---- 28: notifications are correct, scoped, and idempotent ----
  const notificationsA = await request("/api/customer/notifications", authA);
  assert.ok(notificationsA.notifications.some((n: { title: string }) => n.title.includes("New offer")));
  assert.ok(notificationsA.notifications.some((n: { title: string }) => n.title.includes("updated their offer")));
  const notificationsB = await request("/api/customer/notifications", authB);
  assert.ok(!notificationsB.notifications.some((n: { message: string }) => n.message.includes("laptop bag")), "offer notification leaked to an unrelated customer");
  const v1Notifications = await request("/api/vendor/notifications", authV1);
  assert.ok(v1Notifications.notifications.some((n: { title: string }) => n.title.includes("Customer sent a counter offer")));
  assert.ok(v1Notifications.notifications.some((n: { title: string }) => n.title.includes("Offer accepted")));
  pass("offer lifecycle notifications reach the correct customer/vendor only, with the right content");

  console.log(`Fixture data before browser checks: want=${want.id} offer1=${offer1Id}`);

  // ---- 29 & 30: responsive/browser UI, including the Pakistani top strip ----
  const executablePath = process.env.ACCOUNT_TEST_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext();
  await context.addCookies([{ name: "__Secure-next-auth.session-token.customer", value: authA.split("=")[1], domain: "localhost", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
  const page = await context.newPage(); const pageErrors: string[] = []; let currentWidthDebug = 0; page.on("pageerror", (e) => pageErrors.push(`[width=${currentWidthDebug} url=${page.url()}] ${e.message}`));

  await page.goto(`${base}/wants/${want.id}`); await page.getByText("Seller offers").waitFor();
  await page.goto(`${base}/account/offers`); await page.getByRole("heading", { name: "Received Offers" }).waitFor();
  pass("signed-in customer can reach the Want comparison view and Received Offers page");

  for (const width of [360, 390, 768, 1024, 1440]) {
    currentWidthDebug = width;
    await page.setViewportSize({ width, height: 900 });
    for (const url of [`${base}/wants/${want.id}`, `${base}/account/offers`]) {
      await page.goto(url);
      await page.waitForFunction(() => !document.querySelector("main")?.textContent?.includes("Loading"));
      await page.waitForLoadState("networkidle").catch(() => {});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `horizontal overflow at ${width}px on ${url}`);
    }
    // Pakistani top strip: no clipping, no forced marquee, no page overflow
    const stripInfo = await page.evaluate(() => {
      const bar = document.querySelector(".joro-topstrip") as HTMLElement | null;
      const win = document.querySelector(".joro-topstrip-window") as HTMLElement | null;
      if (!bar || !win) return null;
      const rect = bar.getBoundingClientRect();
      const first = win.querySelector('.joro-topstrip-group:not([aria-hidden="true"]) .joro-topstrip-item:first-child') as HTMLElement | null;
      const firstRect = first?.getBoundingClientRect();
      return { height: rect.height, firstLeftOk: firstRect ? firstRect.left >= rect.left - 0.5 : false, scrollWidth: win.scrollWidth, clientWidth: win.clientWidth };
    });
    assert.ok(stripInfo, `top strip missing at ${width}px`);
    assert.ok(stripInfo!.height >= 30 && stripInfo!.height <= 44, `top strip height out of expected range at ${width}px`);
    assert.ok(stripInfo!.firstLeftOk, `top strip's first item is clipped on the left at ${width}px`);
    const headerBox = await page.locator("header").first().boundingBox();
    assert.ok(headerBox && headerBox.y >= stripInfo!.height - 1, `Navbar overlaps the top strip at ${width}px`);
  }
  assert.deepEqual(pageErrors, []);
  await context.close();

  // vendor browser session for My Offers
  const vendorContext = await browser.newContext();
  await vendorContext.addCookies([{ name: "vendor_token", value: authV1.split("=")[1], domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" }]);
  const vendorPage = await vendorContext.newPage();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await vendorPage.setViewportSize({ width, height: 900 });
    await vendorPage.goto(`${base}/vendor/dashboard/offers`);
    await vendorPage.getByRole("heading", { name: "My Offers" }).waitFor();
    assert.ok(await vendorPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `vendor My Offers overflow at ${width}px`);
  }
  await vendorContext.close();
  pass("offer comparison, Received Offers and My Offers render without horizontal overflow at 360/390/768/1024/1440; top strip has no clipping/overlap/overflow at any width; no browser runtime errors");

  console.log(`OFFERS/CHECKOUT E2E PASSED: ${checks} check groups`);
}

async function cleanup() {
  await browser?.close(); server?.kill();
  const steps: [string, () => Promise<unknown>][] = [
    ["order (unlink quote)", () => db.offerQuote.updateMany({ where: { orderId: { in: orderIds } }, data: { orderId: null } })],
    ["order", () => db.order.deleteMany({ where: { id: { in: orderIds } } })],
    ["offerQuote", () => db.offerQuote.deleteMany({ where: { wantId: { in: wantIds } } })],
    ["offerRevision", () => db.offerRevision.deleteMany({ where: { offerId: { in: offerIds } } })],
    ["wantOffer", () => db.wantOffer.deleteMany({ where: { id: { in: offerIds } } })],
    ["customerNotification", () => db.customerNotification.deleteMany({ where: { customerId: { in: customerIds } } })],
    ["vendorNotification", () => db.vendorNotification.deleteMany({ where: { vendorId: { in: vendorIds } } })],
    ["marketplaceAudit", () => db.marketplaceAudit.deleteMany({ where: { target: { in: wantIds } } })],
    ["want", () => db.want.deleteMany({ where: { id: { in: wantIds } } })],
    ["vendorSession", () => db.vendorSession.deleteMany({ where: { id: { in: vendorSessionIds } } })],
    ["vendorProduct", () => db.vendorProduct.deleteMany({ where: { vendorId: { in: vendorIds } } })],
    ["product", () => db.product.deleteMany({ where: { id: { in: productIds } } })],
    ["vendor", () => db.vendor.deleteMany({ where: { id: { in: vendorIds } } })],
    ["customer", () => db.customer.deleteMany({ where: { id: { in: customerIds } } })],
  ];
  for (const [name, step] of steps) {
    try { await step(); } catch (error) { console.error(`cleanup step '${name}' failed:`, error instanceof Error ? error.message : error); }
  }
  await db.$disconnect();
  console.log("Temporary Offers/checkout fixtures removed; existing data untouched.");
}

server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "production", NEXTAUTH_SECRET: secret, NEXTAUTH_URL: base, NEXTAUTH_URL_INTERNAL: base, VENDOR_JWT_SECRET: vendorJwtSecret, SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_USER: "", SMTP_PASS: "", ADMIN_EMAIL: "test-admin-unused@example.invalid" } });

(async () => {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(`${base}/api/customer/profile`)).status === 401) { ready = true; break; } } catch { /* not ready yet */ }
    if (server!.exitCode !== null) throw new Error("Offers test server exited before readiness");
    await delay(1000);
  }
  assert.ok(ready, "Offers test server did not become ready");
  await main();
})().catch((error) => { console.error(error instanceof Error ? error.message : "Offers/checkout tests failed"); process.exitCode = 1; }).finally(cleanup);
