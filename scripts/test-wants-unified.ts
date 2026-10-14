/**
 * JORO-05 unified Wants — end-to-end API checks against a production build.
 * Run after `npm run build` (honours JORO_NEXT_DIST_DIR). Uses only a localhost database and
 * deletes only the fixtures this run creates; existing Wants, offers and customers are untouched.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { SignJWT } from "jose";

config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
const localHosts = ["localhost", "127.0.0.1", "[::1]"];
assert.ok(process.env.DATABASE_URL && localHosts.includes(new URL(process.env.DATABASE_URL).hostname), "Wants tests require a local development database.");
const distDir = process.env.JORO_NEXT_DIST_DIR || ".next";
assert.ok(existsSync(path.join(distDir, "BUILD_ID")), "Run npm run build first.");

const db = new PrismaClient();
const run = `wu${randomUUID().slice(0, 8)}`;
const secret = randomUUID();
const vendorJwtSecret = randomBytes(32).toString("hex");
const port = 3117;
const base = `http://localhost:${port}`;
const photoName = `${run}-ref.png`;
const photoPath = path.join(process.cwd(), "public", "uploads", "wants", photoName);

const customerIds: string[] = []; const vendorIds: string[] = []; const productIds: string[] = []; const wantIds: string[] = [];
const adminIds: string[] = []; const vendorSessionIds: string[] = []; const offerIds: string[] = [];
let checks = 0;
function pass(label: string) { checks++; console.log(`PASS ${String(checks).padStart(2, "0")}: ${label}`); }

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
  await db.vendorSession.create({ data: { id: sessionId, vendorId, tokenHash: createHash("sha256").update(jwt, "utf8").digest("hex"), expiresAt: new Date(Date.now() + 3600_000) } });
  vendorSessionIds.push(sessionId);
  return `vendor_token=${jwt}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function request(pathname: string, auth = "", method = "GET", body?: unknown, expected = 200): Promise<any> {
  const response = await fetch(`${base}${pathname}`, { method, headers: { ...(auth ? { cookie: auth } : {}), "Content-Type": "application/json", Origin: base }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: "manual" });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => "");
  assert.equal(response.status, expected, `${method} ${pathname}: expected ${expected}, received ${response.status} (${isJson ? JSON.stringify(payload) : String(payload).slice(0, 200)})`);
  return payload;
}
async function redirectTarget(pathname: string) {
  const response = await fetch(`${base}${pathname}`, { redirect: "manual" });
  return { status: response.status, location: response.headers.get("location") || "" };
}
const feed = (auth: string, query: string) => request(`/api/wants/feed?${query}`, auth);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const findIn = (page: any, id: string) => page.wants.find((want: { id: string }) => want.id === id);

async function main() {
  await db.$queryRaw`SELECT 1`; pass("local database connection verified");
  await db.wantReaction.count(); pass("JORO-05 migration is applied (wantreaction table exists)");

  // ---------- Fixtures ----------
  const passwordHash = "not-a-valid-password-hash";
  const [owner, joiner, other, inactive] = await Promise.all(["Ayesha Khan", "Bilal Ahmed", "Sana Iqbal", "Dormant User"].map((name, i) =>
    db.customer.create({ data: { email: `${run}-c${i}@example.invalid`, name, passwordHash, phone: "03001234567", isActive: i !== 3 } })));
  customerIds.push(owner.id, joiner.id, other.id, inactive.id);
  const vendorData = (suffix: string, status: "approved" | "pending" | "suspended") => ({ shopName: `Store ${suffix}`, ownerName: "Owner", email: `${run}-${suffix}@example.invalid`, passwordHash, phone: "03001234567", cnic: `${run}-${suffix}`, address: "Test", city: "Lahore", businessType: "individual" as const, bankName: "Test", accountNumber: "test", accountTitle: "Test", status, storeSlug: `${run}-${suffix}`, primaryCategory: "Furniture" });
  const [v1, v2, vPending, vSuspended] = await Promise.all([
    db.vendor.create({ data: vendorData("v1", "approved") }), db.vendor.create({ data: vendorData("v2", "approved") }),
    db.vendor.create({ data: vendorData("vp", "pending") }), db.vendor.create({ data: vendorData("vs", "suspended") }),
  ]);
  vendorIds.push(v1.id, v2.id, vPending.id, vSuspended.id);
  for (const vendor of [v1, v2]) {
    const product = await db.product.create({ data: { name: `Sofa set ${vendor.shopName}`, description: "Test", price: 55000, category: "Furniture", stock: 5, variants: [] } });
    productIds.push(product.id);
    await db.vendorProduct.create({ data: { vendorId: vendor.id, productName: product.name, description: "Test", price: 55000, category: "Furniture", stock: 5, images: [], status: "active", publishedProductId: product.id } });
  }
  const admin = await db.adminUser.create({ data: { email: `${run}-admin@example.invalid`, passwordHash, name: "Ops Admin", role: "operations", permissions: [], isActive: true } });
  adminIds.push(admin.id);
  const [authOwner, authJoiner, authOther] = await Promise.all([customerCookie(owner), customerCookie(joiner), customerCookie(other)]);
  const authAdmin = await adminCookie(admin);
  const [authV1, authV2, authVPending, authVSuspended] = await Promise.all([vendorCookie(v1.id), vendorCookie(v2.id), vendorCookie(vPending.id), vendorCookie(vSuspended.id)]);
  mkdirSync(path.dirname(photoPath), { recursive: true }); writeFileSync(photoPath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const existingWants = await db.want.count({ where: { NOT: { customerId: { in: customerIds } } } });

  const wantBody = { requestType: "PRODUCT", title: `Need a 5 seater sofa ${run}`, description: "Looking for a comfortable sofa set in good condition.", category: "Furniture", city: "Lahore", quantity: 1, budgetFlexible: false, budgetMin: 40000, budgetMax: 60000 };

  // ---------- 2, 3, 4, 5: posting ----------
  await request("/api/wants", "", "POST", wantBody, 401); pass("[2] guest cannot create a Want");
  await request("/api/wants", authV1, "POST", wantBody, 401); pass("[4] vendor session cannot create a customer Want");
  await request("/api/wants", authOwner, "POST", { ...wantBody, photo: [`/uploads/wants/${photoName}`, `/uploads/wants/${photoName}`] }, 400);
  await request("/api/wants", authOwner, "POST", { ...wantBody, photo: `/uploads/wants/${run}-missing.png` }, 400);
  await request("/api/wants", authOwner, "POST", { ...wantBody, photo: "/uploads/wants/../products/x.png" }, 400);
  pass("[5] backend rejects multiple images, unknown files and unsafe image paths");
  const created = await request("/api/wants", authOwner, "POST", { ...wantBody, photo: `/uploads/wants/${photoName}` });
  const wantId: string = created.want.id; wantIds.push(wantId);
  assert.equal(created.want.status, "PENDING_MODERATION");
  pass("[3] customer creates a Want with ONE image; it waits for moderation");

  // ---------- 22: pending never leaks ----------
  assert.equal(findIn(await feed("", `q=${run}`), wantId), undefined);
  await request(`/api/wants/${wantId}`, authOther, "GET", undefined, 404);
  await request(`/api/wants/${wantId}/reaction`, authJoiner, "PUT", { type: "LIKE" }, 404);
  await request(`/api/wants/${wantId}/interest`, authJoiner, "PUT", undefined, 404);
  assert.ok(findIn(await feed(authOwner, `tab=mine&q=${run}`), wantId), "owner should see pending Want in My Wants");
  pass("[22] pending Want stays out of the feed, detail, reactions and joins (owner still sees it)");

  await request("/api/admin/wants", authAdmin, "PATCH", { id: wantId, status: "OPEN", reason: "Approved." });
  const publicPage = await feed("", `q=${run}`);
  const publicItem = findIn(publicPage, wantId);
  assert.ok(publicItem, "approved Want missing from feed");
  assert.equal(publicItem.customer.name, "Ayesha K.");
  assert.equal(publicItem.requestType, "PRODUCT");
  assert.deepEqual(publicItem.images, [`/uploads/wants/${photoName}`]);
  for (const secretValue of [owner.email, owner.id, "03001234567"]) assert.equal(JSON.stringify(publicPage).includes(secretValue), false, `feed leaked ${secretValue}`);
  pass("[1] public visitor sees the approved Want with display name, type and one image — no email, id or phone");

  // ---------- 6: existing Wants intact ----------
  assert.equal(await db.want.count({ where: { NOT: { customerId: { in: customerIds } } } }), existingWants);
  pass("[6] existing Wants are untouched");

  // ---------- 7, 8, 9: reactions ----------
  await request(`/api/wants/${wantId}/reaction`, "", "PUT", { type: "LIKE" }, 401);
  await request(`/api/wants/${wantId}/reaction`, authJoiner, "PUT", { type: "ANGRY" }, 400);
  pass("[7] guests must log in; only the five reaction types are accepted");
  let reacted = await request(`/api/wants/${wantId}/reaction`, authJoiner, "PUT", { type: "LIKE" });
  assert.equal(reacted.reaction, "LIKE"); assert.equal(reacted.reactions.total, 1);
  reacted = await request(`/api/wants/${wantId}/reaction`, authJoiner, "PUT", { type: "LOVE" });
  assert.equal(reacted.reaction, "LOVE"); assert.equal(reacted.reactions.total, 1); assert.equal(reacted.reactions.counts.LIKE, 0);
  reacted = await request(`/api/wants/${wantId}/reaction`, authJoiner, "DELETE");
  assert.equal(reacted.reaction, null); assert.equal(reacted.reactions.total, 0);
  pass("[8] a customer can add, change and remove their reaction");
  await Promise.all([1, 2, 3, 4].map(() => request(`/api/wants/${wantId}/reaction`, authJoiner, "PUT", { type: "FIRE" })));
  await request(`/api/wants/${wantId}/reaction`, authV1, "PUT", { type: "SUPPORT" });
  await request(`/api/wants/${wantId}/reaction`, authVPending, "PUT", { type: "WOW" }, 401);
  await request(`/api/wants/${wantId}/reaction`, authVSuspended, "PUT", { type: "WOW" }, 401);
  assert.equal(await db.wantReaction.count({ where: { wantId } }), 2);
  const afterReactions = findIn(await feed(authJoiner, `q=${run}`), wantId);
  assert.equal(afterReactions.reactions.total, 2); assert.equal(afterReactions.viewer.reaction, "FIRE");
  pass("[9] repeated/parallel reactions never duplicate; approved vendors react under their store; pending/suspended vendors cannot");

  // ---------- 10, 11: join ----------
  await request(`/api/wants/${wantId}/interest`, authOwner, "PUT", undefined, 400);
  await request(`/api/wants/${wantId}/interest`, authV1, "PUT", undefined, 401);
  let joined = await request(`/api/wants/${wantId}/interest`, authJoiner, "PUT");
  joined = await request(`/api/wants/${wantId}/interest`, authJoiner, "PUT");
  assert.equal(joined.joined, true); assert.equal(joined.count, 1);
  const left = await request(`/api/wants/${wantId}/interest`, authJoiner, "DELETE");
  assert.equal(left.joined, false); assert.equal(left.count, 0);
  await request(`/api/wants/${wantId}/interest`, authJoiner, "PUT");
  pass("[10] customer joins and leaves; owner and vendor sessions cannot join");
  const joinedView = findIn(await feed(authJoiner, `q=${run}`), wantId);
  assert.equal(joinedView.joinedCount, 1); assert.equal(joinedView.viewer.joined, true);
  assert.ok(findIn(await feed(authJoiner, "tab=joined"), wantId));
  assert.equal(findIn(await feed(authOther, "tab=joined"), wantId), undefined);
  await request("/api/wants/feed?tab=joined", "", "GET", undefined, 401);
  pass("[11] joined count stays accurate and the Joined tab is per customer");

  // ---------- 12-16: vendor offers ----------
  await request("/api/vendor/offers", authV1, "POST", { wantId, unitPrice: 0 }, 400);
  await request("/api/vendor/offers", authV1, "POST", { wantId, unitPrice: -5 }, 400);
  pass("[13] offer requires a price greater than zero");
  await request("/api/vendor/offers", authVPending, "POST", { wantId, unitPrice: 50000 }, 403);
  await request("/api/vendor/offers", authVSuspended, "POST", { wantId, unitPrice: 50000 }, 403);
  const sent = await request("/api/vendor/offers", authV1, "POST", { wantId, unitPrice: 52000, message: "Brand new, 5 seater.", delivery: "2-3 days in Lahore" });
  const offerId: string = sent.offer.id; offerIds.push(offerId);
  pass("[12] approved vendor sends an offer; pending and suspended vendors cannot");
  const v1View = findIn(await feed(authV1, `q=${run}`), wantId);
  assert.equal(v1View.viewer.vendorOffer.id, offerId); assert.equal(v1View.viewer.vendorOffer.status, "SUBMITTED"); assert.equal(v1View.viewer.canOffer, false);
  assert.equal(findIn(await feed(authV2, `q=${run}`), wantId).viewer.canOffer, true);
  pass("[14] the sending vendor sees Offered (their own offer state); another vendor still sees Send Offer");
  await request("/api/vendor/offers", authV1, "POST", { wantId, unitPrice: 51000 }, 409);
  const v1Offers = await request("/api/vendor/offers", authV1);
  assert.ok(v1Offers.offers.some((offer: { id: string }) => offer.id === offerId));
  assert.ok(!(await request("/api/vendor/offers", authV2)).offers.some((offer: { id: string }) => offer.id === offerId));
  pass("[15] vendor views their own offers; repeated submissions are refused");
  const latest = (await request("/api/account/offers", authOwner)).offers.find((offer: { id: string }) => offer.id === offerId).revisions[0];
  assert.equal(latest.delivery, "2-3 days in Lahore");
  await request(`/api/offers/${offerId}`, authV1, "PATCH", { action: "revise", revisionId: latest.id, productId: latest.productId, price: 50500, quantity: latest.quantity, shipping: 0, delivery: latest.delivery, condition: latest.condition, warranty: "6 months", message: "Revised price.", expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString() });
  await request("/api/vendor/offers", authV2, "POST", { wantId, unitPrice: 53000 }).then(o => offerIds.push(o.offer.id));
  const counted = findIn(await feed("", `q=${run}`), wantId);
  assert.equal(counted.offerVendorCount, 2);
  assert.equal(findIn(await feed(authV1, `q=${run}`), wantId).viewer.vendorOffer.version, 2);
  pass("[16] public count is vendors with offers (2) — a revision does not inflate it");

  // ---------- 17: notifications ----------
  const ownerNotes = await db.customerNotification.findMany({ where: { customerId: owner.id } });
  const newOffer = ownerNotes.find(n => n.idempotencyKey === `offer-submitted:${offerId}`);
  assert.ok(newOffer, "owner did not receive the new-offer notification");
  assert.equal(newOffer.link, `/account/offers#${offerId}`);
  assert.match(newOffer.message, /New offer received for your ".*" request\./);
  assert.ok(ownerNotes.some(n => n.idempotencyKey.startsWith(`offer-revised:${offerId}:`)), "owner did not receive the revised-offer notification");
  assert.equal(await db.customerNotification.count({ where: { customerId: { in: [joiner.id, other.id] }, idempotencyKey: { startsWith: "offer-" } } }), 0);
  const unread = await request("/api/customer/notifications/unread", authOwner);
  assert.ok(unread.unread >= 2);
  await request(`/api/customer/notifications/${newOffer.id}`, authOther, "PATCH", undefined, 404);
  await request(`/api/customer/notifications/${newOffer.id}`, authOwner, "PATCH");
  assert.equal((await request("/api/customer/notifications/unread", authOwner)).unread, unread.unread - 1);
  pass("[17] only the Want owner is notified (new + revised); unread count and mark-as-read work; others cannot touch it");

  // ---------- 18-21: private offer isolation ----------
  const ownerDetail = await request(`/api/wants/${wantId}`, authOwner);
  assert.equal(ownerDetail.want.offers.length, 2);
  assert.ok((await request("/api/account/offers", authOwner)).offers.some((offer: { id: string }) => offer.id === offerId));
  pass("[18] owner sees their private offer details");
  for (const auth of [authOther, authJoiner]) {
    assert.equal((await request(`/api/wants/${wantId}`, auth)).want.offers.length, 0);
    assert.ok(!(await request("/api/account/offers", auth)).offers.some((offer: { id: string }) => offer.id === offerId));
    await request(`/api/offers/${offerId}`, auth, "PATCH", { action: "reject", revisionId: "x" }, 403);
  }
  pass("[19] other customers cannot read or act on that offer");
  pass("[21] a joined customer gains no access to the owner's offers");
  await request(`/api/offers/${offerId}`, authV2, "PATCH", { action: "withdraw", revisionId: "x" }, 403);
  await request(`/api/offers/${offerId}`, authOwner, "PATCH", { action: "withdraw", revisionId: "x" }, 401);
  const publicDetail = await request(`/api/wants/${wantId}`, "");
  assert.equal(publicDetail.want.offers.length, 0);
  assert.equal(JSON.stringify(await feed("", `q=${run}`)).includes("50500"), false);
  pass("[20] competing vendors and the public cannot see or change the offer (owner cannot fake vendor actions)");

  // ---------- 26: quote acceptance still works ----------
  const current = (await request("/api/account/offers", authOwner)).offers.find((offer: { id: string }) => offer.id === offerId);
  const accepted = await request(`/api/offers/${offerId}`, authOwner, "PATCH", { action: "accept", revisionId: current.revisions[0].id, idempotencyKey: randomUUID() });
  assert.ok(accepted.quote?.id);
  assert.equal((await db.wantOffer.findUnique({ where: { id: offerId } }))?.status, "ACCEPTED");
  assert.ok(await db.vendorNotification.findFirst({ where: { vendorId: v1.id, eventKey: `offer-accepted:${offerId}` } }));
  const acceptedView = findIn(await feed(authV1, `q=${run}`), wantId);
  assert.equal(acceptedView.viewer.vendorOffer.status, "ACCEPTED");
  pass("[26] existing quote acceptance works, notifies the vendor, and the vendor sees Accepted");

  // ---------- admin: reports, reactions, hide ----------
  await request(`/api/wants/${wantId}/report`, authOwner, "POST", { reason: "SPAM" }, 400);
  await request(`/api/wants/${wantId}/report`, authOther, "POST", { reason: "SPAM", details: "Looks like an ad" });
  await request(`/api/wants/${wantId}/report`, authOther, "POST", { reason: "SPAM" });
  assert.equal(await db.wantReport.count({ where: { wantId } }), 1);
  const reported = await request("/api/admin/wants?filter=reported", authAdmin);
  assert.ok(reported.wants.some((want: { id: string; _count: { reports: number } }) => want.id === wantId && want._count.reports === 1));
  const review = await request(`/api/admin/wants/${wantId}`, authAdmin);
  assert.equal(review.reports.length, 1); assert.equal(review.reactions.length, 2);
  await request(`/api/admin/wants/${wantId}`, authAdmin, "PATCH", { action: "removeReaction", reactionId: review.reactions[0].id, reason: "Abusive reaction pattern" });
  assert.equal(await db.wantReaction.count({ where: { wantId } }), 1);
  await request(`/api/admin/wants/${wantId}`, authJoiner, "GET", undefined, 401);
  pass("[12-admin] reports are de-duplicated and reviewable; admin can remove abusive reactions; non-admins are refused");

  await request("/api/admin/wants", authAdmin, "PATCH", { id: wantId, status: "CLOSED", reason: "Hidden for review." });
  assert.equal(findIn(await feed("", `q=${run}`), wantId), undefined);
  assert.equal(findIn(await feed("", "tab=trending"), wantId), undefined);
  await request(`/api/wants/${wantId}`, authOther, "GET", undefined, 404);
  await request(`/api/wants/${wantId}/reaction`, authOther, "PUT", { type: "LIKE" }, 404);
  await request(`/api/wants/${wantId}/interest`, authOther, "PUT", undefined, 404);
  assert.equal((await db.wantReport.findFirst({ where: { wantId } }))?.status, "ACTIONED");
  const deactivatedWant = await db.want.create({ data: { customerId: inactive.id, title: `Dormant ${run}`, category: "Furniture", city: "Lahore", budgetFlexible: true, expiresAt: new Date(Date.now() + 86_400_000), status: "OPEN" } });
  wantIds.push(deactivatedWant.id);
  assert.equal(findIn(await feed("", `q=${run}`), deactivatedWant.id), undefined);
  await request(`/api/wants/${deactivatedWant.id}`, "", "GET", undefined, 404);
  pass("[22] hidden Wants and Wants from deactivated owners never leak through feed, trending, detail, reactions or joins");

  // ---------- 23: legacy links ----------
  for (const [from, to] of [
    [`/joro-connect?type=SERVICE&city=Lahore&search=AC`, "/wants?tab=all&type=SERVICE&city=Lahore&q=AC"],
    ["/joro-connect", "/wants?tab=all"],
    ["/joined-requests", "/wants?tab=joined"],
    ["/wants/trending", "/wants?tab=trending"],
  ]) {
    const result = await redirectTarget(from);
    assert.equal(result.status, 308, `${from} status`);
    assert.equal(new URL(result.location, base).pathname + new URL(result.location, base).search, to, from);
  }
  const deepLink = await fetch(`${base}/wants/${wantId}`);
  assert.equal(deepLink.status, 200);
  pass("[23] /joro-connect, /joined-requests and /wants/trending redirect permanently with filters; Want deep links still load");

  // ---------- rate limit ----------
  let limited = false;
  for (let i = 0; i < 40 && !limited; i++) {
    const response = await fetch(`${base}/api/wants/${deactivatedWant.id}/reaction`, { method: "PUT", headers: { cookie: authOther, "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ type: "LIKE" }) });
    limited = response.status === 429;
  }
  assert.ok(limited, "reaction rate limit never triggered");
  pass("[9] rapid repeated reaction requests are rate limited (429)");
}

async function cleanup() {
  server.kill();
  rmSync(photoPath, { force: true });
  const steps: [string, () => Promise<unknown>][] = [
    ["offerQuote", () => db.offerQuote.deleteMany({ where: { wantId: { in: wantIds } } })],
    ["offerRevision", () => db.offerRevision.deleteMany({ where: { offerId: { in: offerIds } } })],
    ["wantOffer", () => db.wantOffer.deleteMany({ where: { wantId: { in: wantIds } } })],
    ["wantReaction", () => db.wantReaction.deleteMany({ where: { wantId: { in: wantIds } } })],
    ["wantReport", () => db.wantReport.deleteMany({ where: { wantId: { in: wantIds } } })],
    ["wantInterest", () => db.wantInterest.deleteMany({ where: { wantId: { in: wantIds } } })],
    ["customerNotification", () => db.customerNotification.deleteMany({ where: { customerId: { in: customerIds } } })],
    ["vendorNotification", () => db.vendorNotification.deleteMany({ where: { vendorId: { in: vendorIds } } })],
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
  console.log(`${checks} checks passed. Temporary JORO-05 fixtures removed; existing data untouched.`);
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  windowsHide: true, stdio: "ignore",
  env: { ...process.env, NODE_ENV: "production", MAINTENANCE_MODE: "false", NEXTAUTH_SECRET: secret, NEXTAUTH_URL: base, NEXTAUTH_URL_INTERNAL: base, VENDOR_JWT_SECRET: vendorJwtSecret, SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_USER: "", SMTP_PASS: "", ADMIN_EMAIL: "test-admin-unused@example.invalid" },
});

(async () => {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try { if ((await fetch(`${base}/api/customer/profile`)).status === 401) { ready = true; break; } } catch { /* not ready yet */ }
    if (server.exitCode !== null) throw new Error("Wants test server exited before readiness");
    await delay(1000);
  }
  assert.ok(ready, "Wants test server did not become ready");
  await main();
})().catch((error) => { console.error("FAILED:", error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(cleanup);
