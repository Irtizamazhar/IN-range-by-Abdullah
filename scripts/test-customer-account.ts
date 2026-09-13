/** Run after npm run build. Uses only localhost DB/server and removes only this run's fixture IDs. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { existsSync } from "node:fs";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { chromium, type Browser } from "playwright-core";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
const localHosts = ["localhost", "127.0.0.1", "[::1]"];
assert.ok(process.env.DATABASE_URL && localHosts.includes(new URL(process.env.DATABASE_URL).hostname), "Account tests require a local development database.");
assert.ok(existsSync(".next/BUILD_ID"), "Run npm run build first.");
const db = new PrismaClient(); const run = `account-test-${randomUUID()}`; const secret = randomUUID();
const port = 3112; const base = `http://localhost:${port}`;
let server: ReturnType<typeof spawn> | undefined; let browser: Browser | undefined;
const customerIds: string[] = []; const orderIds: string[] = []; const wantIds: string[] = []; const offerIds: string[] = []; const vendorIds: string[] = []; const productIds: string[] = []; const serviceIds: string[] = []; const quoteIds: string[] = [];
let checks = 0;
function pass(label: string) { checks++; console.log(`PASS ${checks}: ${label}`); }
async function cookie(customer: { id: string; email: string; name: string }) {
  const token = await encode({ secret, token: { sub: customer.id, role: "customer", sessionVersion: 0, email: customer.email, name: customer.name }, maxAge: 3600 });
  return `__Secure-next-auth.session-token.customer=${token}`;
}
async function request(path: string, auth = "", method = "GET", body?: unknown, expected = 200) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(auth ? { cookie: auth } : {}), "Content-Type": "application/json", Origin: base }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: "manual" });
  assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, received ${response.status}`);
  return response.headers.get("content-type")?.includes("application/json") ? response.json() : response.text();
}
async function main() {
  await db.$queryRaw`SELECT 1`; pass("local database connection verified");
  const customers = [];
  for (const suffix of ["a", "b"]) {
    const c = await db.customer.create({ data: { email: `${run}-${suffix}@example.invalid`, name: `Account Test ${suffix.toUpperCase()}`, passwordHash: "not-a-valid-password-hash", phone: "03001234567" } });
    customers.push(c); customerIds.push(c.id);
  }
  const [a,b] = customers; const authA = await cookie(a); const authB = await cookie(b);
  const vendor = await db.vendor.create({ data: { shopName: "Account Test Store", ownerName: "Test Owner", email: `${run}@example.invalid`, passwordHash: "not-a-valid-password-hash", phone: "03001234567", cnic: run, address: "Test address", city: "Lahore", businessType: "individual", bankName: "Test", accountNumber: "test", accountTitle: "Test", status: "approved", storeSlug: run, primaryCategory: "Other" } }); vendorIds.push(vendor.id);
  const product = await db.product.create({ data: { name: "Account Test Product", description: "Temporary local account test", price: 100, category: "Other", stock: 20, variants: [] } }); productIds.push(product.id);
  const orders = [];
  for (const c of customers) {
    const order = await db.order.create({ data: { orderNumber: `${run}-${c.id}`, customerId: c.id, customerName: c.name, customerPhone: c.phone, customerEmail: a.email, customerAddress: "Temporary test street", city: "Lahore", totalAmount: 1000, paymentMethod: "cod", paymentStatus: "received", orderStatus: "delivered", notes: "INTERNAL_ACCOUNT_TEST", orderItems: { create: { productId: product.id, name: product.name, price: 100, quantity: 10 } } }, include: { orderItems: true } }); orderIds.push(order.id); orders.push(order);
    const want = await db.want.create({ data: { customerId: c.id, title: `Account Want ${c.id}`, category: "Other", city: "Lahore", status: "PENDING_MODERATION", expiresAt: new Date(Date.now()+86400000) } }); wantIds.push(want.id);
    const offer = await db.wantOffer.create({ data: { wantId: want.id, vendorId: vendor.id, revisions: { create: { revisionNumber: 1, initiator: "VENDOR", productId: product.id, price: 100, quantity: 2, shipping: 50, delivery: "3 days", condition: "New", warranty: "12 months", message: "Account test terms", expiresAt: new Date(Date.now()+86400000) } } } }); offerIds.push(offer.id);
    const revision = await db.offerRevision.findFirstOrThrow({ where: { offerId: offer.id } }); const quote = await db.offerQuote.create({ data: { customerId: c.id, wantId: want.id, revisionId: revision.id, idempotencyKey: `${run}-quote-${c.id}`, snapshot: { internal: "INTERNAL_ACCOUNT_TEST" }, expiresAt: new Date(Date.now()+86400000) } }); quoteIds.push(quote.id);
    const ret = await db.returnRequest.create({ data: { customerId: c.id, orderId: order.id, orderItemId: order.orderItems[0].id, quantity: 1, reason: "Test return", status: "vendor_approved", adminNote: "INTERNAL_ACCOUNT_TEST", vendorNote: "INTERNAL_ACCOUNT_TEST" } });
    await db.refund.create({ data: { customerId: c.id, orderId: order.id, returnRequestId: ret.id, amount: 100, idempotencyKey: `${run}-${c.id}`, adminNote: "INTERNAL_ACCOUNT_TEST", externalRef: "INTERNAL_ACCOUNT_TEST" } });
    await db.warrantyRecord.create({ data: { customerId: c.id, orderId: order.id, orderItemId: order.orderItems[0].id, productId: product.id, productName: product.name, quantity: 10, startsAt: new Date(), expiresAt: new Date(Date.now()+86400000*365) } });
    await db.dispute.create({ data: { customerId: c.id, orderId: order.id, type: "order", message: `Account dispute ${c.id}` } });
    await db.customerNotification.create({ data: { customerId: c.id, type: "account_test", title: `Notice ${c.id}`, message: "Local account test", link: c.id === a.id ? "//evil.invalid" : "/account", idempotencyKey: `${run}-${c.id}` } });
  }
  const service = await db.serviceOffering.create({ data: { vendorId: vendor.id, name: "Account Test Assembly", description: "Test", type: "assembly", price: 500, cities: ["Lahore"], durationMinutes: 60, leadDays: 1, warranty: "12 months", cancellationTerms: "Contact support" } }); serviceIds.push(service.id);
  for (const order of orders) await db.orderService.create({ data: { orderId: order.id, vendorId: vendor.id, serviceId: service.id, productId: product.id, quantity: 1, price: 500, commissionRate: 20, commissionAmount: 100, vendorPayable: 400, snapshot: { name: service.name, total: "500", city: "Lahore", warranty: "12 months", cancellationTerms: "Contact support", vendorPayable: "INTERNAL_ACCOUNT_TEST", commissionRate: "INTERNAL_ACCOUNT_TEST" }, events: { create: { actor: "admin", status: "PENDING", note: "INTERNAL_ACCOUNT_TEST" } } } });
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "production", NEXTAUTH_SECRET: secret, NEXTAUTH_URL: base, NEXTAUTH_URL_INTERNAL: base, SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_USER: "", SMTP_PASS: "", ADMIN_EMAIL: "test-admin@example.invalid" } });
  let ready = false;
  for (let attempt=0; attempt<60; attempt++) { try { if ((await fetch(`${base}/api/customer/profile`)).status === 401) { ready = true; break; } } catch {} if (server.exitCode !== null) throw new Error("Account test server exited before readiness"); await delay(1000); }
  assert.ok(ready, "Account test server did not become ready");
  for (const path of ["/api/customer/account", "/api/customer/profile", "/api/customer/addresses", "/api/customer/saved-products", "/api/customer/notifications", "/api/customer/returns", "/api/customer/disputes", "/api/customer/my-stuff", "/api/account/offers", "/api/services/bookings", `/api/customer/orders/${orders[0].id}`]) await request(path,"","GET",undefined,401);
  for (const [path,method,body] of [["/api/customer/profile","PATCH",{name:"Test",phone:""}], ["/api/customer/addresses","POST",{}], ["/api/customer/saved-products","POST",{productId:product.id}], ["/api/customer/notifications","PATCH",{}], ["/api/customer/returns","POST",{}], ["/api/customer/disputes","POST",{}], ["/api/services/bookings","PATCH",{ id: "missing", role: "customer", status: "SCHEDULE_REQUIRED", note: "test" }]] as const) await request(path,"",method,body,401);
  pass("anonymous private API reads and writes reject");
  const account = await request(`/api/customer/account?customerId=${b.id}`,authA);
  assert.deepEqual(account.orders.map((o: {id:string})=>o.id),[orders[0].id]); assert.deepEqual(account.wants.map((w: {id:string})=>w.id),[wantIds[0]]); assert.equal(account.counts.orders,1); assert.equal(account.counts.offers,1); assert.equal(account.profile.email,a.email); assert.ok(!JSON.stringify(account).includes("passwordHash")); pass("real overview and own order/Want counts ignore supplied customer ID");
  assert.equal((await request(`/api/customer/orders/${orders[0].id}`,authA)).order.canCancel,false);
  await request(`/api/customer/orders/${orders[1].id}`,authA,"GET",undefined,404);
  await request(`/api/orders/${orders[1].id}/cancel`,authA,"POST",{customerId:b.id},404);
  const foreignInvoiceResponse = await fetch(`${base}/invoice/${orders[1].id}`, { headers: { cookie: authA } }); const foreignInvoice = await foreignInvoiceResponse.text(); assert.ok([200,404].includes(foreignInvoiceResponse.status)); assert.ok(!foreignInvoice.includes(orders[1].orderNumber)); assert.ok(foreignInvoice.includes("NEXT_NOT_FOUND") || foreignInvoice.includes("404"));
  const ownInvoice = await request(`/invoice/${orders[0].id}`,authA); assert.ok(ownInvoice.includes(orders[0].orderNumber)); pass("own order and invoice work; foreign order, invoice and cancellation reject");
  const offers = await request(`/api/account/offers?customerId=${b.id}`,authA); assert.deepEqual(offers.offers.map((o:{id:string})=>o.id),[offerIds[0]]); assert.equal(offers.offers[0].revisions[0].delivery,"3 days"); pass("received offers contain only own Want terms");
  const quote = await request(`/api/account/quotes/${quoteIds[0]}`,authA); assert.equal(quote.quote.revision.product.name,product.name); assert.ok(!JSON.stringify(quote).includes("INTERNAL_ACCOUNT_TEST")); assert.ok(!JSON.stringify(quote).includes("idempotencyKey")); await request(`/api/account/quotes/${quoteIds[1]}`,authA,"GET",undefined,404); await request(`/api/account/quotes/${quoteIds[0]}`,"","GET",undefined,401); pass("quote access is scoped and private snapshots/keys are omitted");
  await Promise.all([request("/api/customer/saved-products",authA,"POST",{productId:product.id,customerId:b.id}),request("/api/customer/saved-products",authA,"POST",{productId:product.id})]);
  assert.equal(await db.savedProduct.count({where:{customerId:a.id,productId:product.id}}),1); assert.equal((await request("/api/customer/saved-products?idsOnly=1",authB)).ids.length,0);
  assert.equal((await request("/api/customer/saved-products",authA)).products.length,1);
  await db.product.update({where:{id:product.id},data:{isActive:false}}); assert.equal((await request("/api/customer/saved-products",authA)).products[0].available,false); await db.product.update({where:{id:product.id},data:{isActive:true}});
  await request(`/api/customer/saved-products/${product.id}`,authA,"DELETE"); await request(`/api/customer/saved-products/${product.id}`,authA,"DELETE"); assert.equal(await db.savedProduct.count({where:{customerId:a.id}}),0); pass("save/unsave idempotency, isolation and unavailable state");
  await request(`/api/stores/${vendor.id}/follow`,authA,"PUT"); await request(`/api/stores/${vendor.id}/follow`,authA,"PUT");
  assert.equal((await request(`/api/stores/${vendor.id}/follow`,authA)).following,true); assert.equal((await request(`/api/stores/${vendor.id}/follow`,authB)).following,false);
  assert.equal((await request("/api/customer/account",authA)).followedStores[0].storeSlug,run);
  await request(`/api/stores/${vendor.id}/follow`,authA,"DELETE"); assert.equal((await request(`/api/stores/${vendor.id}/follow`,authA)).following,false); pass("Step 1 follow/unfollow persists and account uses canonical slug");
  const notifications = await request("/api/customer/notifications",authA); const otherNotices = await request("/api/customer/notifications",authB);
  assert.equal(notifications.notifications.length,1); assert.equal(notifications.notifications[0].link,null); assert.ok(!JSON.stringify(notifications).includes("idempotencyKey"));
  await request(`/api/customer/notifications/${otherNotices.notifications[0].id}`,authA,"PATCH",{},404);
  await request(`/api/customer/notifications/${notifications.notifications[0].id}`,authA,"PATCH",{}); assert.equal((await request("/api/customer/notifications",authA)).unread,0); assert.equal((await request("/api/customer/notifications",authB)).unread,1); pass("notification privacy, safe links and authorized mark-read");
  const returns = await request("/api/customer/returns",authA); const otherReturns = await request("/api/customer/returns",authB);
  assert.equal(returns.returns.length,1); assert.equal(returns.returns[0].orderId,orders[0].id); assert.ok(returns.returns[0].refund); assert.ok(!JSON.stringify(returns).includes("INTERNAL_ACCOUNT_TEST"));
  await request(`/api/customer/returns/${otherReturns.returns[0].id}`,authA,"PATCH",{customerTracking:"TEST123"},409);
  await request("/api/customer/returns",authA,"POST",{orderItemId:orders[1].orderItems[0].id,quantity:1,reason:"Test reason",customerId:b.id},404);
  await request("/api/customer/disputes",authA,"POST",{orderId:orders[1].id,type:"order",message:"Test ownership rejection",customerId:b.id},404);
  assert.equal((await request("/api/customer/disputes",authA)).disputes[0].orderId,orders[0].id);
  const stuff = await request("/api/customer/my-stuff",authA); assert.equal(stuff.items.length,1); assert.equal(stuff.items[0].orderId,orders[0].id); assert.ok(stuff.items[0].warranty); pass("returns, refunds, disputes and warranties remain private");
  const bookings = await request("/api/services/bookings",authA); const otherBookings = await request("/api/services/bookings",authB);
  assert.equal(bookings.bookings.length,1); assert.ok(!JSON.stringify(bookings).includes("INTERNAL_ACCOUNT_TEST"));
  await request("/api/services/bookings",authA,"PATCH",{id:otherBookings.bookings[0].id,role:"customer",status:"SCHEDULE_REQUIRED",scheduledAt:new Date(Date.now()+86400000).toISOString(),note:"Test request",customerId:b.id},404); pass("service ownership uses customer ID even when order emails match; private fields excluded");
  const profile = await request("/api/customer/profile",authA,"PATCH",{name:"<b>Account Updated</b>",phone:"03007654321",customerId:b.id,email:b.email,passwordHash:"changed",isActive:false,sessionVersion:999}); assert.equal(profile.name,"Account Updated"); assert.equal(profile.email,a.email);
  const fresh = await db.customer.findUniqueOrThrow({where:{id:a.id}}); assert.equal(fresh.passwordHash,a.passwordHash); assert.equal(fresh.sessionVersion,0); assert.equal(fresh.isActive,true); assert.equal((await db.customer.findUniqueOrThrow({where:{id:b.id}})).name,b.name);
  await request("/api/customer/profile",authA,"PATCH",{name:"<script>bad</script>",phone:""},400); pass("profile sanitization and field allowlist preserve auth and other customers");
  const addressInput = {label:"Test Home",recipientName:"Account Updated",phone:"03001234567",address:"Temporary test street",city:"Lahore",isDefault:true,customerId:b.id};
  const created = await Promise.all([request("/api/customer/addresses",authA,"POST",addressInput),request("/api/customer/addresses",authA,"POST",{...addressInput,label:"Test Work"})]);
  const addresses = (await request("/api/customer/addresses",authA)).addresses; assert.equal(addresses.length,2); assert.equal(addresses.filter((v:{isDefault:boolean})=>v.isDefault).length,1);
  const defaultId = addresses.find((v:{isDefault:boolean})=>v.isDefault).id;
  await request(`/api/customer/addresses/${defaultId}`,authA,"PATCH",{city:"Karachi",customerId:b.id}); assert.equal((await db.customerAddress.findUniqueOrThrow({where:{id:defaultId}})).isDefault,true);
  await request(`/api/customer/addresses/${defaultId}`,authB,"PATCH",{city:"Other"},404); await request(`/api/customer/addresses/${defaultId}`,authB,"DELETE",undefined,404);
  await request(`/api/customer/addresses/${defaultId}`,authA,"DELETE"); assert.equal((await request("/api/customer/addresses",authA)).addresses[0].isDefault,true);
  for (const row of created) await db.customerAddress.deleteMany({where:{id:row.address.id,customerId:a.id}}); pass("concurrent addresses preserve one default; edit/delete ownership enforced");
  const pending = await db.order.create({ data: { orderNumber: `IR-TEST-${Date.now()}`, customerId: a.id, customerName: a.name, customerPhone: a.phone, customerEmail: a.email, customerAddress: "Test street", city: "Lahore", totalAmount: 100, paymentMethod: "cod", orderStatus: "pending", paymentStatus: "pending", orderItems: { create: { productId: product.id, name: product.name, price: 100, quantity: 1 } } } }); orderIds.push(pending.id);
  await request(`/api/orders/${orders[1].id}`,authA,"GET",undefined,404); await request(`/api/orders/${orders[0].id}`,"","GET",undefined,404);
  const tracked = await request(`/api/orders/${orders[0].id}`,authA); assert.equal(tracked.canCancel,false); assert.ok(!("notes" in tracked)); assert.equal((await request(`/api/orders/${pending.id}`,authA)).canCancel,true); pass("existing tracking API retains ownership and uses server cancellation eligibility");
  const executablePath = process.env.ACCOUNT_TEST_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  browser = await chromium.launch({executablePath,headless:true});
  const anonymous = await browser.newContext(); const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto(`${base}/account`); await anonymousPage.getByRole("heading",{name:"My JORO",exact:true}).waitFor(); await anonymousPage.getByText("Sign in to view your private account, orders, and saved items.").waitFor(); assert.ok(!(await anonymousPage.locator("main").first().innerText()).includes(orders[0].orderNumber)); pass("anonymous account page displays sign-in without private content"); await anonymous.close();
  const context = await browser.newContext();
  await context.addCookies([{name:"__Secure-next-auth.session-token.customer",value:authA.split("=")[1],domain:"localhost",path:"/",httpOnly:true,secure:true,sameSite:"Lax"}]);
  const page = await context.newPage(); const pageErrors: string[] = []; page.on("pageerror", e=>pageErrors.push(e.message));
  await page.goto(`${base}/account`); await page.getByRole("heading",{name:"Welcome, Account Updated"}).waitFor();
  for (const width of [360,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    for (const path of ["/account","/account?tab=orders","/account?tab=wants","/account?tab=saved","/account?tab=stores","/account?tab=addresses","/account?tab=profile","/account/offers","/account/notifications","/account/services","/my-stuff?tab=returns"]) {
      await page.goto(`${base}${path}`); await page.getByRole("navigation",{name:"My JORO account"}).waitFor();
      await page.waitForFunction(()=>!document.querySelector("main")?.textContent?.includes("Loading"));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`Account overflow at ${width}px ${path}`);
      assert.ok(!(await page.locator("main").first().innerText()).includes(orders[1].orderNumber),"Foreign order rendered");
    }
  }
  pass("all account destinations render without horizontal overflow at 360, 390, 768, 1024 and 1440px");
  await page.goto(`${base}/account/orders/${pending.id}`); await page.getByRole("heading",{name:`Order ${pending.orderNumber}`,exact:true}).waitFor(); await page.getByLabel("Reason",{exact:true}).fill("Local test cancellation"); await page.getByRole("button",{name:"Confirm cancellation"}).click(); await page.getByText("Order cancelled.",{exact:true}).waitFor(); assert.equal((await db.order.findUniqueOrThrow({where:{id:pending.id}})).orderStatus,"cancelled"); await request(`/api/orders/${pending.id}/cancel`,authA,"POST",{reason:"Retry local test"}); pass("valid cancellation works through order detail and idempotent replay; SMTP remains loopback-only");
  await page.goto(`${base}/account/notifications`); await page.getByRole("button",{name:"Mark all read"}).waitFor(); await page.getByRole("button",{name:"Mark all read"}).click(); await page.getByText("0 unread",{exact:true}).waitFor(); await page.reload(); await page.getByText("0 unread",{exact:true}).waitFor(); pass("notification browser mark-read persists after refresh");
  await request("/api/customer/saved-products",authA,"POST",{productId:product.id});
  await page.goto(`${base}/account?tab=saved`); await page.getByRole("button",{name:/remove .* from saved products/i}).waitFor(); await page.reload(); await page.getByRole("button",{name:/remove .* from saved products/i}).click(); await page.getByRole("heading",{name:"Nothing saved yet"}).waitFor(); pass("saved-product heart survives browser refresh and unsaves");
  await request(`/api/stores/${vendor.id}/follow`,authA,"PUT"); await page.goto(`${base}/account?tab=stores`); const storeLink=page.getByRole("link",{name:"View Store",exact:true}); await storeLink.waitFor(); assert.equal(await storeLink.getAttribute("href"),`/stores/${run}`); await page.reload(); await page.getByRole("button",{name:"Unfollow",exact:true}).click(); await page.getByRole("heading",{name:"No followed stores"}).waitFor(); pass("following browser refresh, slug link and unfollow work");
  await page.goto(`${base}/account?tab=profile`); await page.getByLabel("Name",{exact:true}).fill("Account Browser Updated"); await page.getByRole("button",{name:"Save profile"}).click(); await page.getByText("Changes saved.",{exact:true}).waitFor(); await page.reload(); assert.equal(await page.getByLabel("Name",{exact:true}).inputValue(),"Account Browser Updated"); pass("profile browser edit persists across refresh");
  await page.goto(`${base}/account?tab=addresses`); await page.getByRole("button",{name:"Add address",exact:true}).click(); for (const [label,value] of [["Label","Browser Home"],["Recipient name","Account Browser Updated"],["Phone","03001234567"],["City","Lahore"],["Street address","Browser test street"]]) await page.getByLabel(label,{exact:true}).fill(value); await page.getByRole("button",{name:"Save address",exact:true}).click(); await page.getByRole("heading",{name:"Browser Home · Default"}).waitFor(); await page.getByRole("button",{name:"Edit",exact:true}).click(); await page.getByLabel("City",{exact:true}).fill("Karachi"); await page.getByRole("button",{name:"Save address",exact:true}).click(); await page.getByText("Browser test street, Karachi",{exact:false}).waitFor(); await page.getByRole("button",{name:"Delete address",exact:true}).click(); await page.getByRole("heading",{name:"No addresses saved"}).waitFor(); pass("address browser create/edit/delete works");
  await page.goto(`${base}/my-stuff?tab=returns`); await page.getByText("Test return",{exact:true}).waitFor(); await page.goto(`${base}/account/services`); await page.getByRole("heading",{name:"Account Test Assembly"}).waitFor(); await page.getByRole("link",{name:"My Stuff: purchases, warranties & after-sales"}).click(); await page.getByRole("heading",{name:"My Stuff",exact:true}).waitFor(); pass("after-sales deep link and Services/My Stuff navigation work");
  await page.goto(`${base}/account/offers`); await page.getByRole("heading",{name:`Account Want ${a.id}`}).waitFor();
  await context.clearCookies(); await context.addCookies([{name:"__Secure-next-auth.session-token.customer",value:authB.split("=")[1],domain:"localhost",path:"/",httpOnly:true,secure:true,sameSite:"Lax"}]); await page.reload(); await page.getByRole("heading",{name:`Account Want ${b.id}`}).waitFor(); assert.ok(!(await page.locator("main").first().innerText()).includes(`Account Want ${a.id}`));
  assert.deepEqual(pageErrors,[]); pass("switching customer session never retains previous offer data; no browser runtime errors");
  await context.close(); console.log(`ACCOUNT E2E PASSED: ${checks} check groups`);
}
async function cleanup() {
  await browser?.close(); server?.kill();
  await db.serviceEvent.deleteMany({where:{orderService:{orderId:{in:orderIds}}}});
  await db.orderService.deleteMany({where:{orderId:{in:orderIds}}});
  await db.serviceOffering.deleteMany({where:{id:{in:serviceIds}}});
  await db.refund.deleteMany({where:{customerId:{in:customerIds}}});
  await db.dispute.deleteMany({where:{customerId:{in:customerIds}}});
  await db.warrantyRecord.deleteMany({where:{customerId:{in:customerIds}}});
  await db.returnRequest.deleteMany({where:{customerId:{in:customerIds}}});
  await db.offerQuote.deleteMany({where:{id:{in:quoteIds}}});
  await db.offerRevision.deleteMany({where:{offerId:{in:offerIds}}});
  await db.wantOffer.deleteMany({where:{id:{in:offerIds}}});
  await db.want.deleteMany({where:{id:{in:wantIds}}});
  await db.order.deleteMany({where:{id:{in:orderIds}}});
  await db.customer.deleteMany({where:{id:{in:customerIds}}});
  await db.product.deleteMany({where:{id:{in:productIds}}});
  await db.vendor.deleteMany({where:{id:{in:vendorIds}}});
  await db.$disconnect(); console.log("Temporary account fixtures removed; existing data untouched.");
}
main().catch(error=>{ console.error(error instanceof Error ? error.message : "Account tests failed"); process.exitCode=1; }).finally(cleanup);