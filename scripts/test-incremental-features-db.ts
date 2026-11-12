/* eslint-disable @typescript-eslint/no-explicit-any -- Real disposable DB with request/session/mail adapters. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "dotenv";
import ts from "typescript";

const requireLocal = createRequire(import.meta.url);
const source = new URL(parse(fs.readFileSync(".env")).DATABASE_URL);
assert.ok(["127.0.0.1","localhost"].includes(source.hostname) && (source.port || "3306") === "3306", "Local MySQL only");
const name = `joro_incremental_test_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0,8)}`;
assert.match(name, /^joro_incremental_test_\d+_[a-f0-9]{8}$/);
const systemUrl = new URL(source); systemUrl.pathname = "/mysql";
const target = new URL(source); target.pathname = "/" + name;
const system = new PrismaClient({ datasourceUrl: systemUrl.toString() });
let db: PrismaClient | undefined, created = false, stage = "disposable database setup", checks = 0;
const pass = (label: string) => { checks++; console.log(`PASS ${checks}: ${label}`); };
const cli = (args: string[]) => { const r = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], { env: { ...process.env, NODE_ENV: "test", DATABASE_URL: target.toString(), RUST_LOG: "info" }, encoding: "utf8", maxBuffer: 5*1024*1024 }); assert.equal(r.status, 0, "Disposable Prisma command failed"); };
async function main() {
  await system.$executeRawUnsafe(`CREATE DATABASE \`${name}\``); created = true;
  cli(["migrate","deploy"]); cli(["migrate","diff","--from-url",target.toString(),"--to-schema-datamodel","prisma/schema.prisma","--exit-code"]);
  Object.assign(process.env, { DATABASE_URL: target.toString(), NODE_ENV: "test" });
  db = new PrismaClient({ datasourceUrl: target.toString() });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = db;
  const database = db;
  pass("all migrations replay and schema drift comparison passes in a NEW disposable database");
  const passwordHash = "isolated-test-no-login";
  const customer = await db.customer.create({ data: { name: "Fixture Customer", email: "customer@example.invalid", passwordHash } });
  const admin = await db.adminUser.create({ data: { name: "Fixture Support", email: "admin@example.invalid", passwordHash, role: "super_admin", permissions: ["*"] } });
  const product = await db.product.create({ data: { name: "Fixture catalog item", slug: "fixture-catalog-item", description: "Fixture", price: 1200, stock: 10, category: "Fixture", variants: [], isFeatured: true } });
  await db.settings.create({ data: { codCharges: 123, codAvailableCities: ["Lahore"] } });
  let signedIn = false, authorized = false, enabled = true;
  const jar = new Map<string,string>(), mails: any[] = [];
  const requestContext = new AsyncLocalStorage<{ jar: Map<string,string>; admin: boolean }>();
  const marketplace = await import("../lib/marketplace-api");
  const modules: Record<string,any> = {
    "@/lib/prisma": { prisma: db }, "@/lib/marketplace-api": { ...marketplace, customerActor: async () => { if (requestContext.getStore() || !signedIn) throw new marketplace.ApiError(401,"Customer sign-in required."); return customer; }, api: (work: () => Promise<unknown>) => marketplace.api(work) },
    "@/lib/incremental-features": { incrementalFeatures: () => ({ chat: enabled, newsletter: enabled, promotions: enabled, guestCheckout: enabled }) },
    "@/lib/sessions": { getCustomerSession: async () => !requestContext.getStore() && signedIn ? { user: { id: customer.id, email: customer.email, role: "customer" } } : null },
    "next/headers": { cookies: () => ({ get: (key: string) => { const current = requestContext.getStore()?.jar || jar; return current.has(key) ? { value: current.get(key) } : undefined; } }) },
    "@/lib/customer-registration-origin": await import("../lib/customer-registration-origin"),
    "@/lib/mailer": { isMailConfigured: () => true, sendMail: async (mail: any) => { mails.push(mail); return true; } },
    "@/lib/seo": await import("../lib/seo"), "@/lib/seo-data": await import("../lib/seo-data"),
    "@/lib/catalog-product-select": await import("../lib/catalog-product-select"),
    "@/lib/admin-permissions": await import("../lib/admin-permissions"),
    "@/lib/admin-rbac": { requireAdminPermission: async () => (requestContext.getStore()?.admin ?? authorized) ? { admin: { id: admin.id } } : { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }, writeAdminAudit: async (tx: Prisma.TransactionClient, data: any) => tx.adminAuditLog.create({ data }) },
    "@/lib/vendor-auth-server": { getVendorFromSession: async () => null },
    "@/lib/settings-db": { getOrCreateSettings: async () => ({ codAvailableCities: ["Lahore"], codCharges: 123 }) },
    "@/lib/order-emails": { notifyAdminNewOrder: async () => {} },
    "@/lib/vendor-notifications": { createVendorNotification: async () => {} },
    "@/lib/auto-cancel-orders": {},
  };
  function load(file: string) { const exports: any = {}; runInNewContext(ts.transpileModule(fs.readFileSync(file,"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { exports, require: (key: string) => { if (key in modules) return modules[key]; assert.ok(!key.startsWith("@/"), `Missing safe test adapter: ${key}`); return requireLocal(key); }, process, console, Buffer, Date, URL, URLSearchParams, Request, Response, setTimeout, clearTimeout }); return exports; }
  modules["@/lib/public-feature-security"] = load("lib/public-feature-security.ts");
  modules["@/lib/live-chat-service"] = load("lib/live-chat-service.ts");
  modules["@/lib/newsletter-service"] = load("lib/newsletter-service.ts");
  modules["@/lib/guest-checkout"] = load("lib/guest-checkout.ts");
  modules["@/lib/homepage-promotions"] = load("lib/homepage-promotions.ts");
  const request = (path: string, body?: unknown) => new NextRequest("https://joro.pk"+path, { method: body === undefined ? "GET" : "POST", headers: { Origin: "https://joro.pk", Host: "joro.pk", "Content-Type": "application/json", "Idempotency-Key": "test-"+randomUUID(), "x-real-ip": "127.0.0.1" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  function captureCookie(response: Response, cookie: string) { const raw = response.headers.get("set-cookie") || ""; assert.match(raw,/HttpOnly/i); const value = new RegExp(cookie+"=([a-f0-9]{64})").exec(raw)?.[1]; assert.ok(value); jar.set(cookie,value); return value; }
  const chat = load("app/api/live-chat/route.ts"), inbox = load("app/api/admin/live-chat/route.ts");
  stage = "chat isolation and bidirectional delivery";
  assert.equal((await inbox.GET(request("/api/admin/live-chat"))).status,403);
  assert.equal((await chat.GET()).status,401);
  const started = await chat.POST(request("/api/live-chat",{ action:"start", name:"Fixture Guest", email:"guest@example.invalid" })); assert.equal(started.status,200); const chatToken = captureCookie(started,"joro_live_chat");
  let view = await (await chat.GET()).json(); assert.equal(view.available,false); assert.equal(view.messages.length,0);
  const body = { message:"Real visitor test message", clientKey:randomUUID() };
  assert.equal((await chat.POST(request("/api/live-chat",body))).status,200);
  assert.equal((await chat.POST(request("/api/live-chat",body))).status,200);
  assert.equal(await db.supportMessage.count(),1);
  authorized = true;
  const list = await (await inbox.GET(request("/api/admin/live-chat"))).json(); assert.equal(list.conversations.length,1); assert.equal(list.conversations[0].unread,true);
  const ticketId = list.conversations[0].ticketId;
  await inbox.POST(request("/api/admin/live-chat",{ticketId,message:"Private staff note",internal:true,clientKey:randomUUID()}));
  await inbox.POST(request("/api/admin/live-chat",{ticketId,message:"Real human reply",clientKey:randomUUID()}));
  view = await (await chat.GET()).json(); assert.equal(view.messages.length,2); assert.ok(!JSON.stringify(view).includes("Private staff note")); assert.ok(!JSON.stringify(view).includes("tokenHash")); assert.equal(view.messages[1].body,"Real human reply");
  assert.equal(view.unreadCount,1);
  assert.equal((await chat.POST(request("/api/live-chat",{action:"read",through:view.readThrough}))).status,200);
  assert.equal((await (await chat.GET()).json()).unreadCount,0);
  await inbox.POST(request("/api/admin/live-chat",{action:"presence",available:true})); assert.equal((await (await chat.GET()).json()).available,true);
  await db.liveChatPresence.updateMany({data:{expiresAt:new Date(0)}}); assert.equal((await (await chat.GET()).json()).available,false);
  await inbox.POST(request("/api/admin/live-chat",{action:"status",ticketId,status:"RESOLVED"})); assert.equal((await chat.POST(request("/api/live-chat",{message:"Blocked",clientKey:randomUUID()}))).status,409);
  assert.equal((await chat.POST(request("/api/live-chat",{action:"reopen"}))).status,200);
  jar.set("joro_live_chat","f".repeat(64)); assert.equal((await chat.GET()).status,401); jar.set("joro_live_chat",chatToken);
  signedIn=true; const registered = await chat.POST(request("/api/live-chat",{action:"start"})); assert.equal(registered.status,200); captureCookie(registered,"joro_live_chat"); signedIn=false; assert.equal((await chat.GET()).status,401);
  pass("guest/customer chat persists; admin replies arrive by next poll; notes/private credentials stay hidden; replay, resolution, ownership and presence expiry enforced");
  const newsletter = load("app/api/newsletter/route.ts");
  stage="newsletter confirmation and privacy";
  let response = await newsletter.POST(request("/api/newsletter",{email:customer.email,consent:true})); assert.equal(response.status,200);
  let subscription = await db.newsletterSubscription.findUniqueOrThrow({where:{email:customer.email}}); assert.equal(subscription.customerId,null); assert.equal(subscription.status,"PENDING");
  const confirmation = /confirm#token=([a-f0-9]{64})/.exec(mails[0].text)?.[1], unsubscribe = /unsubscribe#token=([a-f0-9]{64})/.exec(mails[0].text)?.[1]; assert.ok(confirmation&&unsubscribe); assert.notEqual(subscription.confirmationHash,confirmation);
  assert.equal((await newsletter.POST(request("/api/newsletter",{action:"confirm",token:confirmation}))).status,200);
  assert.equal((await newsletter.POST(request("/api/newsletter",{action:"confirm",token:confirmation}))).status,400);
  assert.equal(await db.newsletterSubscription.count(),1); assert.equal((await db.customer.findUniqueOrThrow({where:{id:customer.id}})).marketingEmailConsentAt,null);
  assert.equal((await newsletter.POST(request("/api/newsletter",{action:"unsubscribe",token:unsubscribe}))).status,200);
  assert.equal((await db.newsletterSubscription.findUniqueOrThrow({where:{email:customer.email}})).status,"UNSUBSCRIBED");
  signedIn=true; assert.equal((await newsletter.POST(request("/api/newsletter",{consent:true}))).status,200); const confirmed = /confirm#token=([a-f0-9]{64})/.exec(mails[1].text)?.[1]; assert.equal((await newsletter.POST(request("/api/newsletter",{action:"confirm",token:confirmed}))).status,200);
  assert.ok((await db.customer.findUniqueOrThrow({where:{id:customer.id}})).marketingEmailConsentAt);
  assert.equal((await (await newsletter.GET()).json()).status,"SUBSCRIBED"); assert.equal((await newsletter.DELETE(new NextRequest("https://joro.pk/api/newsletter",{method:"DELETE",headers:{Origin:"https://joro.pk"}}))).status,200); signedIn=false;
  pass("newsletter double opt-in, single-use confirmation, hashed tokens, unsubscribe and signed-in consent work with intercepted mail; guest email match does not link an account");
  stage="promotion eligibility and scheduling";
  const promotions = load("app/api/admin/homepage-promotions/route.ts");
  authorized=false; assert.equal((await promotions.GET()).status,403); authorized=true;
  const campaign = { title:"Fixture catalog discovery", subtitle:"Fixture only", href:"/products/fixture-catalog-item", image:null, placement:"BANNER",enabled:true,position:1,startAt:null,endAt:null };
  assert.equal((await promotions.POST(request("/api/admin/homepage-promotions",{...campaign,href:"//evil.invalid"}))).status,400);
  assert.equal((await promotions.POST(request("/api/admin/homepage-promotions",campaign))).status,200);
  let additions = await modules["@/lib/homepage-promotions"].homepageAdditions(); assert.equal(additions.promotions.length,1); assert.equal(additions.featured.id,product.id);
  await db.homepagePromotion.updateMany({data:{endAt:new Date(0)}}); assert.equal((await modules["@/lib/homepage-promotions"].homepageAdditions()).promotions.length,0);
  pass("promotion RBAC, safe canonical destinations, genuine featured data and expiry enforcement work");
  stage="durable shared limits";
  await modules["@/lib/public-feature-security"].featureRate("fixture","actor",2,60); await modules["@/lib/public-feature-security"].featureRate("fixture","actor",2,60);
  await assert.rejects(()=>modules["@/lib/public-feature-security"].featureRate("fixture","actor",2,60),e=>(e as {status:number}).status===429);
  pass("database-backed rate limits persist across requests and reject excess actions");
  stage="loading checkout handlers";
  for(const key of ["checkout-addresses","checkout-diagnostics","catalog-product-select","prisma-order-includes","serialize","vendor-commission","handling-fee","coupon-service","offer-checkout-service","service-checkout-service","order-confirmation-delivery","cod-cities"]) modules["@/lib/"+key] = await import("../lib/"+key);
  modules["@/lib/order-number"]={generateOrderNumber:async()=>"TEST-"+randomUUID()}; modules["@/lib/vendor-shop-order-number"]={generateVendorShopOrderNumber:async()=>"SHOP-"+randomUUID()}; modules["@/lib/marketplace-prisma"]={getMarketplacePrisma:()=>database,getMarketplaceTx:(tx:any)=>tx};
  const orders=load("app/api/orders/route.ts"), tracking=load("app/api/guest-orders/[id]/route.ts"), guestSession=load("app/api/checkout/guest-session/route.ts");
  stage="guest transaction and protected replay";
  const sessionResponse=await guestSession.POST(request("/api/checkout/guest-session",{})); assert.equal(sessionResponse.status,200); const guestToken=captureCookie(sessionResponse,"joro_guest_checkout");
  const payload={customerName:"Fixture Guest",customerPhone:"03001234567",customerAddress:"Fixture Street 22",city:"Lahore",country:"Pakistan",paymentMethod:"cod",expectedHandlingFee:0,products:[{productId:product.id,quantity:2}]};
  const orderRequest=request("/api/orders",payload), replayKey=orderRequest.headers.get("Idempotency-Key")!;
  const result=await orders.POST(orderRequest); assert.equal(result.status,200); const receipt=await result.json(); const order=await db.order.findUniqueOrThrow({where:{id:receipt._id}}); assert.equal(order.customerId,null); assert.equal(Number(order.totalAmount),2523); assert.equal(await db.customer.count(),1); assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,8);
  const replay=()=>{const r=request("/api/orders",payload);r.headers.set("Idempotency-Key",replayKey);return orders.POST(r);}; assert.equal((await replay()).status,200); assert.equal(await db.order.count(),1);
  assert.equal((await tracking.GET(request("/api/guest-orders/"+order.id),{params:{id:order.id}})).status,200);
  jar.set("joro_guest_checkout","e".repeat(64));assert.equal((await replay()).status,409);assert.equal((await tracking.GET(request("/api/guest-orders/"+order.id),{params:{id:order.id}})).status,404);jar.set("joro_guest_checkout",guestToken);
  assert.equal((await orders.POST(request("/api/orders",{...payload,city:"Invalid City"}))).status,400);
  assert.equal((await orders.POST(request("/api/orders",{...payload,products:[{productId:product.id,quantity:99}]}))).status,400);
  assert.equal(await db.order.count(),1); assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,8);
  signedIn=true; assert.equal((await orders.POST(request("/api/orders",payload))).status,200);assert.equal(await db.order.count({where:{customerId:customer.id}}),1);signedIn=false;
  const vendor=await db.vendor.create({data:{shopName:"Fixture Seller",ownerName:"Fixture Owner",email:"seller@example.invalid",passwordHash,address:"Fixture street",status:"approved"}});
  await db.vendorProduct.create({data:{vendorId:vendor.id,productName:product.name,description:"Fixture",price:1200,stock:6,category:"Fixture",images:[],status:"active",publishedProductId:product.id}});
  stage="smart search public visibility and canonical DTO";
  const category=await db.category.create({data:{name:"Fixture",slug:"fixture-search-category",image:"/icon.png",isActive:true}});
  await db.product.update({where:{id:product.id},data:{categoryRecordId:category.id}});
  const search=await import("../lib/search-suggestions");
  assert.equal((await search.readSearchSuggestions("")).find(item=>item.id===product.id)?.href,"/products/fixture-catalog-item");
  assert.ok((await search.readSearchSuggestions("FIXTURE catalog")).some(item=>item.id===product.id));
  assert.ok((await search.readSearchSuggestions("Fixture")).some(item=>item.href==="/categories/fixture-search-category"));
  await db.vendor.update({where:{id:vendor.id},data:{status:"pending"}});
  assert.ok(!(await search.readSearchSuggestions("Fixture")).some(item=>item.id===product.id||item.id===category.id));
  await db.vendor.update({where:{id:vendor.id},data:{status:"approved"}});
  assert.equal((await search.readSearchSuggestions("\" OR 1=1 -- <script>")).length,0);
  pass("smart search defaults, case/partial matching, genuine prices and slug/category URLs pass; unapproved vendor products and their empty categories are excluded");
  const sellerOrderResponse=await orders.POST(request("/api/orders",payload));assert.equal(sellerOrderResponse.status,200);
  const sellerOrder=await sellerOrderResponse.json();assert.equal(await db.vendorShopOrder.count({where:{orderId:sellerOrder._id,customerId:null,vendorId:vendor.id}}),1);
  assert.equal(await db.orderInventoryLine.count({where:{orderId:sellerOrder._id,state:"awaiting_confirmation"}}),1);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,6);
  await db.guestOrderAccess.update({where:{orderId:order.id},data:{expiresAt:new Date(0)}});assert.equal((await tracking.GET(request("/api/guest-orders/"+order.id),{params:{id:order.id}})).status,404);
  pass("real guest and registered checkout preserve totals, stock, history and outbox; guest idempotency and tracking require the correct private owner; invalid city/stock roll back without fake accounts");
  stage="real feature browser flows against isolated MySQL";
  modules["@/lib/security/rate-limit"] = await import("../lib/security/rate-limit");
  const feePreview=load("app/api/checkout/handling-fee/route.ts"), settings=await import("../lib/settings-db");
  const routeMap:Record<string,any>={"/api/live-chat":chat,"/api/admin/live-chat":inbox,"/api/newsletter":newsletter,"/api/checkout/guest-session":guestSession,"/api/orders":orders,"/api/checkout/handling-fee":feePreview};
  const bridge = (url:string,method:string,body:string|undefined,headers:Record<string,string>,isAdmin:boolean) => {
    const cookies=new Map<string,string>();for(const pair of (headers.cookie||"").split(";")){const index=pair.indexOf("=");if(index>0)cookies.set(pair.slice(0,index).trim(),decodeURIComponent(pair.slice(index+1)));}
    return requestContext.run({jar:cookies,admin:isAdmin},async()=>{const pathname=new URL(url,"https://joro.pk").pathname;if(pathname==="/api/settings")return NextResponse.json(await settings.readPublicSettings());const handler=routeMap[pathname]?.[method];if(!handler)return NextResponse.json({error:"Fixture route unavailable"},{status:404});const forwarded=new Headers(headers);forwarded.set("origin","https://joro.pk");forwarded.set("host","joro.pk");const r=new NextRequest("https://joro.pk"+url,{method,headers:forwarded,...(body?{body}:{})});return handler(r);});
  };
  const browserModule = await import("./test-incremental-browser.mjs");
  await browserModule.runIncrementalBrowser(bridge,product,async(email:string)=>{const mail=mails.filter(m=>m.to===email).at(-1);assert.ok(mail);return{confirm:/confirm#token=([a-f0-9]{64})/.exec(mail.text)?.[1],unsubscribe:/unsubscribe#token=([a-f0-9]{64})/.exec(mail.text)?.[1]};});
  pass("actual guest/customer and admin React components deliver messages without reload, preserve guest access on refresh, confirm/unsubscribe email and complete guest checkout through real isolated handlers");
  enabled=false;assert.equal((await chat.GET()).status,404);assert.equal((await newsletter.GET()).status,404);
  pass("disabled release flags fail closed before feature database access");
  console.log(`PASS: ${checks} disposable-database integration groups; no production connection, mail or orders.`);
}
main().catch(error=>{console.error(`Isolated feature verification failed at ${stage}; code ${(error as {code?:string}).code || "ASSERTION"}. Raw SQL/credentials withheld.`); console.error((error as Error).stack?.split("\n").filter(line=>/^\s+at .*test-incremental-features-db/.test(line)).slice(0,2).join("\n"));process.exitCode=1;}).finally(async()=>{await db?.$disconnect();if(created){assert.match(name,/^joro_incremental_test_\d+_[a-f0-9]{8}$/);await system.$executeRawUnsafe(`DROP DATABASE \`${name}\``);}await system.$disconnect();});
