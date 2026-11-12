import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { ApiError } from "../lib/marketplace-api";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Request and database tripwire adapters.
function load(file: string, modules: Record<string, any>) {
  const exports: Record<string, unknown> = {};
  runInNewContext(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(key:string)=>modules[key]??require(key),process:{env:{}},Date,URL,Buffer,Response,Request});
  return exports;
}

test("smart suggestions use bounded public-only reads and expose only catalog fields", async () => {
  const calls: Record<string, unknown>[] = [];
  const visibility = { isActive: true, OR: [{ vendorPublication: { is: null } }, { vendorPublication: { is: { status: "active", vendor: { status: "approved" } } } }] };
  const module = load("lib/search-suggestions.ts", {
    "@/lib/prisma": { prisma: { product: { findMany: async (args: Record<string, unknown>) => { calls.push(args); return [{ id: "legacy", slug: "real-watch", name: "Real watch", category: "Watches", price: "1200", originalPrice: "1500", listingImageUrls: ["/watch.webp"], productImages: [], privateNote: "MUST NOT LEAK" }]; } }, category: { findMany: async (args: Record<string, unknown>) => { calls.push(args); return [{ id: "category", slug: "watches", name: "Watches" }]; } } } },
    "@/lib/seo-data": { indexableProductWhere: visibility },
    "@/lib/catalog-urls": { productPath: (p: {slug:string}) => "/products/" + p.slug },
    "@/lib/public-search": { normalizeSearchQuery: (q:string) => q.trim().replace(/\s+/g," ").slice(0,100) },
  });
  const read = module.readSearchSuggestions as (q:string)=>Promise<{href:string;price:number;image:string}[]>;
  const rows = await read("  ｗａｔｃｈ\n strap ");
  assert.equal(rows[0].href,"/products/real-watch"); assert.equal(rows[0].price,1200); assert.equal(rows[0].image,"/watch.webp"); assert.equal(rows[1].href,"/categories/watches");
  assert.ok(!JSON.stringify(rows).includes("MUST NOT LEAK"));
  assert.equal(calls[0].take,6); assert.equal(calls[1].take,3);
  const where = calls[0].where as {AND:unknown[]}; assert.deepEqual(where.AND[0],visibility); assert.ok(JSON.stringify(where).includes('"contains":"watch"'));
  calls.length=0; await read(""); assert.equal(calls.length,2); assert.ok(JSON.stringify(calls[0].orderBy).includes("isFeatured"));
});

test("suggestion endpoint rejects overlong and rate-limited requests before database reads", async () => {
  let reads=0, allowed=true;
  const route = load("app/api/search/suggestions/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/search-suggestions": { readSearchSuggestions: async () => { reads++; return []; } },
    "@/lib/security/rate-limit": { createApiRateLimiter:()=>({}),consumeOrReject:async()=>allowed?{ok:true}:{ok:false,retrySecs:42} },
  }) as {GET:(request:unknown)=>Promise<Response>};
  const request=(q:string)=>({nextUrl:new URL("https://joro.pk/api/search/suggestions?q="+encodeURIComponent(q)),headers:new Headers()});
  assert.equal((await route.GET(request("a".repeat(101)))).status,400); assert.equal(reads,0);
  allowed=false; const limited=await route.GET(request("watch")); assert.equal(limited.status,429); assert.equal(limited.headers.get("Retry-After"),"42"); assert.equal(reads,0);
  allowed=true; const defaults=await route.GET(request("")); assert.equal(defaults.status,200); assert.equal(reads,1); assert.equal(defaults.headers.get("Cache-Control"),"private, no-store");
});
test("all incremental capabilities default off without querying a database", () => {
  const module = load("lib/incremental-features.ts",{});
  const flags = (module.incrementalFeatures as () => Record<string,boolean>)();
  assert.deepEqual(JSON.parse(JSON.stringify(flags)),{promotions:false,chat:false,newsletter:false,guestCheckout:false});
});
test("promotion validation refuses external/private destinations, executable media and inverted schedules", () => {
  const modules = { "@/lib/prisma": { prisma:{} }, "@/lib/incremental-features":{}, "@/lib/marketplace-api":{ApiError}, "@/lib/seo-data":{}, "@/lib/catalog-product-select":{} };
  const schema = load("lib/homepage-promotions.ts",modules).homepagePromotionInput as { safeParse:(value:unknown)=>{success:boolean} };
  const base = {title:"Verified campaign",href:"/products/catalog-slug",image:null,placement:"BANNER",enabled:false,position:0,startAt:null,endAt:null};
  assert.equal(schema.safeParse(base).success,true);
  for(const href of ["https://evil.invalid","//evil.invalid","/api/orders","/checkout","/products/%2fadmin","/products/a?redirect=https://evil.invalid"])assert.equal(schema.safeParse({...base,href}).success,false);
  assert.equal(schema.safeParse({...base,image:"/uploads/banner.svg"}).success,false);
  assert.equal(schema.safeParse({...base,startAt:"2026-11-12T00:00:00Z",endAt:"2026-11-11T00:00:00Z"}).success,false);
});
test("guest coupons preserve account restrictions and optional email never creates an identity", () => {
  const module=load("lib/guest-checkout.ts",{"@/lib/prisma":{prisma:{}},"@/lib/incremental-features":{},"@/lib/marketplace-api":{ApiError},"@/lib/public-feature-security":{}});
  const allowed=module.guestCouponAllowed as (value:unknown)=>void,email=module.guestEmail as (value:unknown)=>string;
  assert.doesNotThrow(()=>allowed({perCustomerLimit:null,customerIds:[]}));
  assert.throws(()=>allowed({perCustomerLimit:1,customerIds:[]}),/Sign in/);
  assert.throws(()=>allowed({perCustomerLimit:null,customerIds:["account"]}),/Sign in/);
  assert.equal(email(undefined),"");assert.equal(email("TEST@example.invalid"),"test@example.invalid");assert.throws(()=>email("not an email"),/valid email/);
});
test("disabled chat and newsletter APIs stop before touching private records or sessions", async () => {
  const fail=()=>{throw Error("Private data must not be accessed");};
  const modules={"@/lib/prisma":{prisma:new Proxy({},{get:fail})},"@/lib/marketplace-api":{ApiError,api:async(work:()=>Promise<unknown>)=>{try{return Response.json(await work());}catch(e){assert.ok(e instanceof ApiError);return Response.json({error:e.message},{status:e.status});}}},"@/lib/incremental-features":{incrementalFeatures:()=>({chat:false,newsletter:false})},"@/lib/public-feature-security":new Proxy({},{get:()=>fail}),"@/lib/newsletter-service":new Proxy({},{get:()=>fail}),"@/lib/live-chat-service":new Proxy({},{get:()=>fail}),"@/lib/sessions":{getCustomerSession:fail}};
  for(const file of ["app/api/live-chat/route.ts","app/api/newsletter/route.ts"]){const route=load(file,modules) as {GET:()=>Promise<Response>;POST:(r:Request)=>Promise<Response>};assert.equal((await route.GET()).status,404);assert.equal((await route.POST(new Request("https://joro.pk/api/fixture",{method:"POST"}))).status,404);}
});
