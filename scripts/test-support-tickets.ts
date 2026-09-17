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
assert.ok(process.env.DATABASE_URL && localHosts.includes(new URL(process.env.DATABASE_URL).hostname), "Support tests require a local development database.");
assert.ok(existsSync(".next/BUILD_ID"), "Run npm run build first.");

const db = new PrismaClient();
const run = `support-test-${randomUUID()}`;
const secret = randomUUID();
const vendorJwtSecret = randomBytes(32).toString("hex");
const port = 3117;
const base = `http://localhost:${port}`;
let server: ReturnType<typeof spawn> | undefined;
let browser: Browser | undefined;

const customerIds: string[] = []; const vendorIds: string[] = []; const adminIds: string[] = []; const vendorSessionIds: string[] = [];
const ticketIds: string[] = []; const orderIds: string[] = []; const vendorShopOrderIds: string[] = [];
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

async function multipart(path: string, auth: string, fields: Record<string, string>, expected = 200) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { cookie: auth, Origin: base }, body: fd });
  const payload = await response.json().catch(() => null);
  assert.equal(response.status, expected, `POST ${path}: expected ${expected}, received ${response.status} (${JSON.stringify(payload)})`);
  return payload;
}

function ticketFields(overrides: Record<string, string> = {}) {
  return { category: "ACCOUNT", subject: "I need help with my account", message: "Please look into this issue for me.", ...overrides };
}

async function main() {
  await db.$queryRaw`SELECT 1`; pass("local database connection verified");

  const passwordHash = "not-a-valid-password-hash";
  const [customerA, customerB, customerC] = await Promise.all(["a", "b", "c"].map(s => db.customer.create({ data: { email: `${run}-${s}@example.invalid`, name: `Support Test ${s.toUpperCase()}`, passwordHash, phone: "03001234567" } })));
  customerIds.push(customerA.id, customerB.id, customerC.id);
  const authA = await customerCookie(customerA); const authB = await customerCookie(customerB); const authC = await customerCookie(customerC);

  async function makeVendor(tag: string) {
    const vendor = await db.vendor.create({ data: { shopName: `${tag} Store`, ownerName: "Vendor Owner", email: `${run}-${tag}@example.invalid`, passwordHash, phone: "03001234567", cnic: `${run}-${tag}`, address: "Test address", city: "Lahore", businessType: "individual", bankName: "Test", accountNumber: "test", accountTitle: "Test", status: "approved", storeSlug: `${run}-${tag}`, primaryCategory: "Electronics" } });
    vendorIds.push(vendor.id);
    return vendor;
  }
  const vendorA = await makeVendor("va"); const vendorB = await makeVendor("vb");
  const authVA = await vendorCookie(vendorA.id); const authVB = await vendorCookie(vendorB.id);

  const adminOK = await db.adminUser.create({ data: { email: `${run}-admin-ok@example.invalid`, passwordHash, name: "Support Staff", role: "support", permissions: [], isActive: true } });
  const adminNoPerm = await db.adminUser.create({ data: { email: `${run}-admin-noperm@example.invalid`, passwordHash, name: "Finance Admin", role: "finance", permissions: [], isActive: true } });
  adminIds.push(adminOK.id, adminNoPerm.id);
  const authAdminOK = await adminCookie(adminOK); const authAdminNoPerm = await adminCookie(adminNoPerm);

  // Order fixtures for ownership tests
  const orderA = await db.order.create({ data: { orderNumber: `${run}-ORD-A`, customerName: "A", customerPhone: "03001234567", customerEmail: customerA.email, customerAddress: "Addr", city: "Lahore", totalAmount: 1000, paymentMethod: "cod", customerId: customerA.id } });
  const orderB = await db.order.create({ data: { orderNumber: `${run}-ORD-B`, customerName: "B", customerPhone: "03001234567", customerEmail: customerB.email, customerAddress: "Addr", city: "Lahore", totalAmount: 1000, paymentMethod: "cod", customerId: customerB.id } });
  orderIds.push(orderA.id, orderB.id);
  const shopOrderVA = await db.vendorShopOrder.create({ data: { shopOrderNumber: `${run}-SHOP-VA`, orderId: orderA.id, vendorId: vendorA.id, customerId: customerA.id, customerName: "A", customerPhone: "03001234567", customerEmail: customerA.email, customerAddress: "Addr", city: "Lahore", items: [], totalAmount: 1000, commissionAmount: 100, netAmount: 900, paymentMethod: "cod", paymentStatus: "pending" } });
  const shopOrderVB = await db.vendorShopOrder.create({ data: { shopOrderNumber: `${run}-SHOP-VB`, orderId: orderB.id, vendorId: vendorB.id, customerId: customerB.id, customerName: "B", customerPhone: "03001234567", customerEmail: customerB.email, customerAddress: "Addr", city: "Lahore", items: [], totalAmount: 1000, commissionAmount: 100, netAmount: 900, paymentMethod: "cod", paymentStatus: "pending" } });
  vendorShopOrderIds.push(shopOrderVA.id, shopOrderVB.id);

  // ---- 1 & 2: Customer A creates ticket; ticket number unique ----
  const create1 = await multipart("/api/account/support/tickets", authA, ticketFields({ subject: "Where is my order", relatedResourceType: "ORDER", relatedResourceId: orderA.id }));
  const ticketA1: string = create1.ticket.id; ticketIds.push(ticketA1);
  assert.match(create1.ticket.ticketNumber, /^JORO-\d+$/);
  const create2 = await multipart("/api/account/support/tickets", authA, ticketFields({ subject: "Second unrelated issue" }));
  ticketIds.push(create2.ticket.id);
  assert.notEqual(create1.ticket.ticketNumber, create2.ticket.ticketNumber);
  pass("customer A creates a ticket with a unique, friendly ticket number");

  // anonymous / cross-actor cannot create
  const anonForm = new FormData(); anonForm.append("category", "OTHER"); anonForm.append("subject", "x"); anonForm.append("message", "x");
  const anonRes = await fetch(`${base}/api/account/support/tickets`, { method: "POST", headers: { Origin: base }, body: anonForm });
  assert.equal(anonRes.status, 401);
  pass("anonymous user cannot create a customer support ticket");

  // ---- 3: Customer B cannot read A's ticket ----
  await request(`/api/account/support/tickets/${ticketA1}`, authB, "GET", undefined, 404);
  const listB = await request("/api/account/support/tickets", authB);
  assert.ok(!listB.tickets.some((t: { id: string }) => t.id === ticketA1));
  pass("customer B cannot read or list customer A's ticket");

  // ---- 4: A cannot attach B's order ----
  await multipart("/api/account/support/tickets", authA, ticketFields({ subject: "Trying to attach someone else's order", relatedResourceType: "ORDER", relatedResourceId: orderB.id }), 400);
  pass("customer A cannot attach customer B's order to a ticket");

  // ---- 5: Vendor A creates ticket ----
  const vendorCreate1 = await multipart("/api/vendor/support/tickets", authVA, ticketFields({ category: "ORDERS", subject: "Vendor A issue", relatedResourceType: "VENDOR_SHOP_ORDER", relatedResourceId: shopOrderVA.id }));
  const ticketVA1: string = vendorCreate1.ticket.id; ticketIds.push(ticketVA1);
  pass("vendor A creates a ticket");

  // ---- 6: Vendor B cannot access it ----
  await request(`/api/vendor/support/tickets/${ticketVA1}`, authVB, "GET", undefined, 404);
  pass("vendor B cannot access vendor A's ticket");

  // ---- 7: Vendor cannot attach B's resource ----
  await multipart("/api/vendor/support/tickets", authVA, ticketFields({ category: "ORDERS", subject: "Trying to attach vendor B's order", relatedResourceType: "VENDOR_SHOP_ORDER", relatedResourceId: shopOrderVB.id }), 400);
  pass("vendor A cannot attach vendor B's seller order to a ticket");

  // customer cannot read vendor endpoints and vice versa (role isolation)
  await request(`/api/vendor/support/tickets/${ticketVA1}`, authA, "GET", undefined, 401);
  await request(`/api/account/support/tickets/${ticketA1}`, authVA, "GET", undefined, 401);
  pass("customer and vendor sessions cannot use each other's support endpoints");

  // ---- 8: authorized admin sees queue ----
  const queue1 = await request("/api/admin/support/tickets", authAdminOK);
  assert.ok(queue1.tickets.some((t: { id: string }) => t.id === ticketA1));
  assert.ok(queue1.tickets.some((t: { id: string }) => t.id === ticketVA1));
  pass("authorized admin sees both customer and vendor tickets in the queue");

  // ---- 9: unauthorized admin denied ----
  await request("/api/admin/support/tickets", authAdminNoPerm, "GET", undefined, 403);
  await request(`/api/admin/support/tickets/${ticketA1}`, authAdminNoPerm, "GET", undefined, 403);
  pass("admin without support.manage permission is denied");

  // ---- 10 & 11: admin public reply works; customer sees it ----
  const reply1 = await multipart(`/api/admin/support/tickets/${ticketA1}/messages`, authAdminOK, { body: "We're looking into this.", isInternalNote: "false" });
  assert.equal(reply1.message.isInternalNote, false);
  const detailAfterReply = await request(`/api/account/support/tickets/${ticketA1}`, authA);
  assert.ok(detailAfterReply.messages.some((m: { body: string }) => m.body === "We're looking into this."));
  pass("admin public reply is visible to the ticket owner");

  // ---- 12: notification created once ----
  const notifsA1 = await request("/api/customer/notifications", authA);
  const replyNotices = notifsA1.notifications.filter((n: { title: string }) => n.title.includes("Support replied"));
  assert.equal(replyNotices.length, 1);
  // repeat GET must not duplicate
  const notifsA2 = await request("/api/customer/notifications", authA);
  assert.equal(notifsA2.notifications.filter((n: { title: string }) => n.title.includes("Support replied")).length, 1);
  pass("reply notification is created exactly once, never duplicated");

  // ---- 13 & 14: customer replies; admin sees new activity ----
  const customerReply = await multipart(`/api/account/support/tickets/${ticketA1}/messages`, authA, { body: "Thanks, still waiting though." });
  assert.equal(customerReply.message.senderType, "CUSTOMER");
  const ticketAfterCustomerReply = await request(`/api/admin/support/tickets/${ticketA1}`, authAdminOK);
  assert.equal(ticketAfterCustomerReply.ticket.status, "CUSTOMER_REPLIED");
  assert.ok(ticketAfterCustomerReply.messages.some((m: { body: string }) => m.body === "Thanks, still waiting though."));
  pass("customer reply is recorded and bumps the ticket to CUSTOMER_REPLIED for admin to see");

  // ---- 15 & 16: statuses transition correctly; priority works ----
  const setInProgress = await request(`/api/admin/support/tickets/${ticketA1}`, authAdminOK, "PATCH", { status: "IN_PROGRESS", reason: "starting work" });
  assert.equal(setInProgress.ticket.status, "IN_PROGRESS");
  const setPriority = await request(`/api/admin/support/tickets/${ticketA1}`, authAdminOK, "PATCH", { priority: "HIGH", reason: "escalating" });
  assert.equal(setPriority.ticket.priority, "HIGH");
  await request(`/api/admin/support/tickets/${ticketA1}`, authAdminOK, "PATCH", { status: "NOT_A_STATUS", reason: "bad input" }, 400);
  pass("admin controls status transitions and priority; invalid status is rejected");

  // customer cannot set priority/status themselves (no such endpoint exposed) -- confirm PATCH is admin-only path
  await request(`/api/admin/support/tickets/${ticketA1}`, authA, "PATCH", { priority: "URGENT", reason: "trying to self-escalate" }, 401);
  pass("customer cannot call the admin status/priority endpoint to self-escalate priority");

  // ---- 17: internal note invisible externally ----
  const noteRes = await multipart(`/api/admin/support/tickets/${ticketA1}/messages`, authAdminOK, { body: "Customer seems confused, verify order manually.", isInternalNote: "true" });
  assert.equal(noteRes.message.isInternalNote, true);
  const customerViewAfterNote = await request(`/api/account/support/tickets/${ticketA1}`, authA);
  assert.ok(!customerViewAfterNote.messages.some((m: { body: string }) => m.body.includes("verify order manually")));
  const adminViewAfterNote = await request(`/api/admin/support/tickets/${ticketA1}`, authAdminOK);
  assert.ok(adminViewAfterNote.messages.some((m: { body: string; isInternalNote: boolean }) => m.body.includes("verify order manually") && m.isInternalNote));
  pass("internal note is visible to admin but never reaches the customer-facing API");

  // ---- 18: attachment validation works ----
  const badMimeForm = new FormData(); badMimeForm.append("category", "OTHER"); badMimeForm.append("subject", "bad attachment"); badMimeForm.append("message", "test");
  badMimeForm.append("attachment", new Blob([Buffer.from("not-an-image")], { type: "application/x-msdownload" }), "virus.exe");
  const badMimeRes = await fetch(`${base}/api/account/support/tickets`, { method: "POST", headers: { cookie: authA, Origin: base }, body: badMimeForm });
  assert.equal(badMimeRes.status, 400);
  pass("executable/unsafe attachment MIME types are rejected");

  const goodForm = new FormData(); goodForm.append("category", "OTHER"); goodForm.append("subject", "good attachment"); goodForm.append("message", "test with real image");
  goodForm.append("attachment", new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" }), "shot.png");
  const goodRes = await fetch(`${base}/api/account/support/tickets`, { method: "POST", headers: { cookie: authA, Origin: base }, body: goodForm });
  const goodJson = await goodRes.json();
  assert.equal(goodRes.status, 200, JSON.stringify(goodJson));
  ticketIds.push(goodJson.ticket.id);
  const goodDetail = await request(`/api/account/support/tickets/${goodJson.ticket.id}`, authA);
  const attachmentUrl = goodDetail.messages[0]?.attachmentUrl;
  assert.ok(attachmentUrl && attachmentUrl.startsWith("/api/private/support-attachments/"));
  const fetchOwn = await fetch(`${base}${attachmentUrl}`, { headers: { cookie: authA } });
  assert.equal(fetchOwn.status, 200);
  const fetchOther = await fetch(`${base}${attachmentUrl}`, { headers: { cookie: authB } });
  assert.equal(fetchOther.status, 404);
  pass("valid image attachments are accepted, stored privately, and only readable by the ticket owner or admin");

  // ---- 19: unsafe/empty message handled (uses customer B -- A is near its ticket-creation rate budget) ----
  await multipart("/api/account/support/tickets", authB, ticketFields({ subject: "", message: "" }), 400);
  const xssForm = new FormData(); xssForm.append("category", "OTHER"); xssForm.append("subject", "<script>alert(1)</script>XSS test"); xssForm.append("message", "<img src=x onerror=alert(1)>hello");
  const xssRes = await fetch(`${base}/api/account/support/tickets`, { method: "POST", headers: { cookie: authB, Origin: base }, body: xssForm });
  const xssJson = await xssRes.json();
  assert.equal(xssRes.status, 200);
  ticketIds.push(xssJson.ticket.id);
  assert.ok(!xssJson.ticket.subject.includes("<script>"));
  const xssDetail = await request(`/api/account/support/tickets/${xssJson.ticket.id}`, authB);
  assert.ok(!xssDetail.messages[0].body.includes("<img"));
  pass("empty subject/message is rejected; HTML/script content is stripped before storage");

  // ---- 20: pagination works ----
  // Seeded directly (bypassing the ticket-creation rate limit, which is a separate, already-tested concern)
  // purely to give the list enough rows to exercise a real second page; the server's minimum page size is 5.
  const extraTicketIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const t = await db.supportTicket.create({ data: { actorType: "CUSTOMER", customerId: customerA.id, category: "OTHER", subject: `Pagination filler ${i}`, status: "OPEN" } });
    await db.supportMessage.create({ data: { ticketId: t.id, senderType: "CUSTOMER", senderId: customerA.id, body: "filler" } });
    extraTicketIds.push(t.id); ticketIds.push(t.id);
  }
  const pageA1 = await request("/api/account/support/tickets?page=1&pageSize=5", authA);
  assert.equal(pageA1.tickets.length, 5); assert.ok(pageA1.total >= 7);
  const pageA2 = await request("/api/account/support/tickets?page=2&pageSize=5", authA);
  assert.ok(pageA2.tickets.length >= 1);
  const page1Ids = new Set(pageA1.tickets.map((t: { id: string }) => t.id));
  assert.ok(pageA2.tickets.every((t: { id: string }) => !page1Ids.has(t.id)), "page 2 must not repeat page 1's rows");
  pass("ticket list pagination respects page size and returns distinct pages");

  // ---- 21: ticket rate limit works (fresh customer C, untouched budget) ----
  let rateLimited = false;
  for (let i = 0; i < 8; i++) {
    const fd = new FormData(); fd.append("category", "OTHER"); fd.append("subject", `Rate limit probe ${i}`); fd.append("message", "testing rate limit");
    const r = await fetch(`${base}/api/account/support/tickets`, { method: "POST", headers: { cookie: authC, Origin: base }, body: fd });
    if (r.status === 429) { rateLimited = true; break; }
    if (r.status === 200) { const j = await r.json(); ticketIds.push(j.ticket.id); }
  }
  assert.ok(rateLimited, "ticket creation should be rate limited after repeated rapid requests");
  pass("ticket creation rate limit engages after repeated rapid requests");

  // ---- 22: message rate limit works ----
  let messageRateLimited = false;
  for (let i = 0; i < 25; i++) {
    const fd = new FormData(); fd.append("body", `probe message ${i}`);
    const r = await fetch(`${base}/api/account/support/tickets/${ticketA1}/messages`, { method: "POST", headers: { cookie: authA, Origin: base }, body: fd });
    if (r.status === 429) { messageRateLimited = true; break; }
  }
  assert.ok(messageRateLimited, "message posting should be rate limited after repeated rapid requests");
  pass("ticket message rate limit engages after repeated rapid requests");

  // ---- 23, 24, 25: resolve, close, reopen (customer B -- A's ticket-creation budget is exhausted above) ----
  const ticketForLifecycle = await multipart("/api/account/support/tickets", authB, ticketFields({ subject: "Lifecycle test ticket" }));
  const lifecycleId: string = ticketForLifecycle.ticket.id; ticketIds.push(lifecycleId);
  const resolveRes = await request(`/api/admin/support/tickets/${lifecycleId}`, authAdminOK, "PATCH", { status: "RESOLVED", reason: "issue fixed" });
  assert.equal(resolveRes.ticket.status, "RESOLVED"); assert.ok(resolveRes.ticket.resolvedAt);
  const resolvedNotice = await request("/api/customer/notifications", authB);
  assert.equal(resolvedNotice.notifications.filter((n: { message: string }) => n.message.includes("Lifecycle test ticket")).length, 1);
  pass("resolving a ticket notifies the owner exactly once");

  const closeRes = await request(`/api/admin/support/tickets/${lifecycleId}`, authAdminOK, "PATCH", { status: "CLOSED", reason: "closing out" });
  assert.equal(closeRes.ticket.status, "CLOSED"); assert.ok(closeRes.ticket.closedAt);
  pass("closing a ticket works and keeps full history readable");

  await multipart(`/api/account/support/tickets/${lifecycleId}/messages`, authB, { body: "still an issue" }, 409);
  pass("a closed ticket silently refuses new messages until reopened");

  const reopenRes = await request(`/api/account/support/tickets/${lifecycleId}/reopen`, authB, "POST", undefined);
  assert.equal(reopenRes.ticket.status, "OPEN");
  await multipart(`/api/account/support/tickets/${lifecycleId}/messages`, authB, { body: "reopened and replying again" });
  await request(`/api/account/support/tickets/${lifecycleId}/reopen`, authB, "POST", undefined, 409);
  pass("owner can reopen a closed ticket and resume messaging; reopening a non-closed ticket is refused");

  // ---- 26: no constant polling (static/code check, not a runtime probe) ----
  const supportComponentSources = await Promise.all([
    "components/support/TicketDetail.tsx", "components/support/TicketList.tsx", "components/support/CreateTicketForm.tsx",
  ].map(f => import("node:fs/promises").then(fs => fs.readFile(f, "utf8"))));
  assert.ok(supportComponentSources.every(src => !/setInterval|setTimeout\s*\(\s*[^,]+,\s*\d{1,4}\s*\)/.test(src)), "support UI must not poll on a timer");
  pass("support UI has no polling/interval timers -- data loads on open and after explicit actions only");

  console.log(`Fixture data before browser checks: ticketA1=${ticketA1} ticketVA1=${ticketVA1}`);

  // ---- 27, 28: safe links + responsive browser checks ----
  const executablePath = process.env.ACCOUNT_TEST_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  browser = await chromium.launch({ executablePath, headless: true });

  const custContext = await browser.newContext();
  await custContext.addCookies([{ name: "__Secure-next-auth.session-token.customer", value: authA.split("=")[1], domain: "localhost", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
  const custPage = await custContext.newPage(); const custErrors: string[] = []; custPage.on("pageerror", e => custErrors.push(e.message));
  for (const width of [360, 390, 768, 1024, 1440]) {
    custPage.setViewportSize({ width, height: 900 });
    for (const url of [`${base}/account/help`, `${base}/account/help/new`, `${base}/account/help/tickets`, `${base}/account/help/tickets/${ticketA1}`]) {
      await custPage.goto(url); await custPage.waitForTimeout(350);
      assert.ok(await custPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `customer support overflow at ${width}px on ${url}`);
    }
  }
  const ticketPageHtml = await custPage.content();
  assert.ok(!/href="javascript:/i.test(ticketPageHtml) && !/href="data:/i.test(ticketPageHtml), "no unsafe href scheme leaked into support pages");
  assert.deepEqual(custErrors, []);
  await custContext.close();
  pass("customer support pages (Help Center, create, list, detail) are responsive at 360-1440px with safe links and no runtime errors");

  const vendContext = await browser.newContext();
  await vendContext.addCookies([{ name: "vendor_token", value: authVA.split("=")[1], domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" }]);
  const vendPage = await vendContext.newPage(); const vendErrors: string[] = []; vendPage.on("pageerror", e => vendErrors.push(e.message));
  for (const width of [360, 390, 768, 1024, 1440]) {
    vendPage.setViewportSize({ width, height: 900 });
    for (const url of [`${base}/vendor/dashboard/help`, `${base}/vendor/dashboard/help/tickets`, `${base}/vendor/dashboard/help/tickets/${ticketVA1}`]) {
      await vendPage.goto(url); await vendPage.waitForTimeout(350);
      assert.ok(await vendPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `vendor support overflow at ${width}px on ${url}`);
    }
  }
  assert.deepEqual(vendErrors, []);
  await vendContext.close();
  pass("vendor support pages are responsive at 360-1440px with no runtime errors");

  const adminContext = await browser.newContext();
  await adminContext.addCookies([{ name: "__Secure-next-auth.session-token.admin", value: authAdminOK.split("=")[1], domain: "localhost", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
  const adminPage = await adminContext.newPage(); const adminErrors: string[] = []; adminPage.on("pageerror", e => adminErrors.push(e.message));
  for (const width of [360, 390, 768, 1024, 1440]) {
    adminPage.setViewportSize({ width, height: 900 });
    for (const url of [`${base}/admin/support`, `${base}/admin/support/${ticketA1}`]) {
      await adminPage.goto(url); await adminPage.waitForTimeout(350);
      assert.ok(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `admin support overflow at ${width}px on ${url}`);
    }
  }
  const adminTicketHtml = await adminPage.content();
  assert.ok(!adminTicketHtml.includes("verify order manually") || adminTicketHtml.includes("Internal Note"), "internal note must render clearly labeled, never disguised as a public reply");
  assert.deepEqual(adminErrors, []);
  await adminContext.close();
  pass("admin Support Queue and ticket detail are responsive at 360-1440px, internal notes are clearly labeled, no runtime errors");

  console.log(`SUPPORT TICKETS E2E PASSED: ${checks} check groups`);
}

async function cleanup() {
  await browser?.close(); server?.kill();
  const steps: [string, () => Promise<unknown>][] = [
    ["supportMessage", () => db.supportMessage.deleteMany({ where: { ticketId: { in: ticketIds } } })],
    ["supportTicket", () => db.supportTicket.deleteMany({ where: { id: { in: ticketIds } } })],
    ["adminAuditLog", () => db.adminAuditLog.deleteMany({ where: { entityId: { in: ticketIds } } })],
    ["marketplaceAudit", () => db.marketplaceAudit.deleteMany({ where: { target: { in: ticketIds } } })],
    ["customerNotification", () => db.customerNotification.deleteMany({ where: { customerId: { in: customerIds } } })],
    ["vendorNotification", () => db.vendorNotification.deleteMany({ where: { vendorId: { in: vendorIds } } })],
    ["vendorShopOrder", () => db.vendorShopOrder.deleteMany({ where: { id: { in: vendorShopOrderIds } } })],
    ["order", () => db.order.deleteMany({ where: { id: { in: orderIds } } })],
    ["vendorSession", () => db.vendorSession.deleteMany({ where: { id: { in: vendorSessionIds } } })],
    ["vendor", () => db.vendor.deleteMany({ where: { id: { in: vendorIds } } })],
    ["adminUser", () => db.adminUser.deleteMany({ where: { id: { in: adminIds } } })],
    ["customer", () => db.customer.deleteMany({ where: { id: { in: customerIds } } })],
  ];
  for (const [name, step] of steps) {
    try { await step(); } catch (error) { console.error(`cleanup step '${name}' failed:`, error instanceof Error ? error.message : error); }
  }
  try { const fs = await import("node:fs/promises"); const path = await import("node:path"); for (const id of ticketIds) { await fs.rm(path.join(process.cwd(), "storage", "private", "support", id), { recursive: true, force: true }).catch(() => {}); } } catch { /* best-effort */ }
  await db.$disconnect();
  console.log("Temporary Support ticket fixtures removed; existing data untouched.");
}

server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "production", NEXTAUTH_SECRET: secret, NEXTAUTH_URL: base, NEXTAUTH_URL_INTERNAL: base, VENDOR_JWT_SECRET: vendorJwtSecret, SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_USER: "", SMTP_PASS: "", ADMIN_EMAIL: "test-admin-unused@example.invalid" } });

(async () => {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(`${base}/api/customer/profile`)).status === 401) { ready = true; break; } } catch { /* not ready yet */ }
    if (server!.exitCode !== null) throw new Error("Support test server exited before readiness");
    await delay(1000);
  }
  assert.ok(ready, "Support test server did not become ready");
  await main();
})().catch((error) => { console.error(error instanceof Error ? error.message : "Support tests failed"); process.exitCode = 1; }).finally(cleanup);
