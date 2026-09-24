/** Production browser regression. Local DB only; temporary server and run-scoped fixtures. */
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import {setTimeout as delay} from "node:timers/promises";
import {existsSync,mkdirSync,rmSync} from "node:fs";
import path from "node:path";
import {config} from "dotenv";
import bcrypt from "bcryptjs";
import {PrismaClient} from "@prisma/client";
import {encode} from "next-auth/jwt";
import {chromium,type Browser,type Page} from "playwright-core";
config({path:".env.local",quiet:true});config({path:".env",quiet:true});
assert.ok(process.env.DATABASE_URL&&["localhost","127.0.0.1","[::1]"].includes(new URL(process.env.DATABASE_URL).hostname),"Local DB required");
assert.ok(existsSync(".next/BUILD_ID"),"Build first");
const run="pre10-ui-"+randomUUID(),secret=randomUUID(),base="http://localhost:3118";
const db=new PrismaClient();let browser:Browser;let server:ReturnType<typeof spawn>|undefined;let count=0; let pageNumber=1;
const vendors:string[]=[];const customers:string[]=[];const snapshots=path.join(process.env.TEMP||".","joro-prestep10-screens");mkdirSync(snapshots,{recursive:true});
function pass(s:string){console.log("PASS "+(++count)+": "+s);}
async function stop(){if(server){server.kill();await Promise.race([new Promise(r=>server!.once("exit",r)),delay(5000)]);server=undefined;}}
async function start(social:boolean){
 await stop();
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p","3118"],{stdio:"ignore",env:{...process.env,NODE_ENV:"production",NEXTAUTH_SECRET:secret,VENDOR_JWT_SECRET:secret,NEXTAUTH_URL:base,NEXTAUTH_URL_INTERNAL:base,NEXT_PUBLIC_APP_URL:base,GOOGLE_CLIENT_ID:social?"fixture-google":"",GOOGLE_CLIENT_SECRET:social?"fixture-google-secret":"",FACEBOOK_CLIENT_ID:social?"fixture-facebook":"",FACEBOOK_CLIENT_SECRET:social?"fixture-facebook-secret":"",VENDOR_REQUIRE_EMAIL_VERIFICATION:"false",EMAIL_HOST:"127.0.0.1",EMAIL_PORT:"1",EMAIL_USER:"",EMAIL_PASS:"",SMTP_HOST:"127.0.0.1",SMTP_PORT:"1",SMTP_USER:"",SMTP_PASS:"",ADMIN_EMAIL:"test-admin@example.invalid"}});
 for(let i=0;i<60;i++){try{if((await fetch(base+"/api/auth/providers")).ok)return;}catch{}if(server.exitCode!==null)throw Error("Test server exited");await delay(1000);}throw Error("Server not ready");
}
async function ready(page:Page,role="customer",mode="signin"){await page.goto(base+"/login?role="+role+"&mode="+mode);await page.getByLabel("Email",{exact:true}).waitFor();}
async function noOverflow(page:Page,label:string){const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(size.scroll<=size.width+1,label+" horizontal overflow: "+JSON.stringify(size));}
async function json(page:Page,url:string,method="GET",body?:unknown){return page.request.fetch(base+url,{method,headers:{Origin:base},...(body===undefined?{}:{data:body})});}
async function vendorLogin(page:Page,email:string){await ready(page,"vendor");await page.getByLabel("Email",{exact:true}).fill(email);await page.getByLabel("Password",{exact:true}).fill("Test123456");await page.getByRole("button",{name:"Sign In as Vendor",exact:true}).click();}
async function main(){
 const passwordHash=await bcrypt.hash("Test123456",10);
 const active=await db.customer.create({data:{name:"Active Customer",email:run+"-customer@example.invalid",passwordHash}});customers.push(active.id);
 const inactive=await db.customer.create({data:{name:"Inactive Customer",email:run+"-inactive@example.invalid",passwordHash,isActive:false}});customers.push(inactive.id);
 const statusVendors=[];
 for(const status of ["approved","pending","suspended","rejected"] as const){const v=await db.vendor.create({data:{ownerName:"Seller Owner",email:run+"-"+status+"@example.invalid",passwordHash,address:"Test address",status,isEmailVerified:true}});vendors.push(v.id);statusVendors.push(v);}
 browser=await chromium.launch({executablePath:process.env.ACCOUNT_TEST_BROWSER||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true});
 await start(false);
 const providers=await (await fetch(base+"/api/auth/providers")).json();assert.ok(providers.credentials&&!providers.google);pass("missing provider credentials preserve password authentication");
 let page=await browser.newPage({extraHTTPHeaders:{"x-forwarded-for":"127.0.0."+ (++pageNumber)}});
 await ready(page,"customer","signup");
 await page.getByLabel("Full Name",{exact:true}).fill("New Customer");const signupEmail=run+"-signup@example.invalid";
 await page.getByLabel("Email",{exact:true}).fill(signupEmail);await page.getByLabel("Password",{exact:true}).fill("Test123456");await page.getByLabel("Confirm Password",{exact:true}).fill("Different123");
 await page.getByRole("button",{name:"Create Account",exact:true}).click();await page.getByText("Passwords do not match.",{exact:true}).waitFor();
 await page.getByLabel("Confirm Password",{exact:true}).fill("Test123456");await page.getByRole("button",{name:"Create Account",exact:true}).click();await page.waitForURL(base+"/",{timeout:20000});
 const signed=await db.customer.findUniqueOrThrow({where:{email:signupEmail}});customers.push(signed.id);
 await page.goto(base+"/login");await page.getByRole("link",{name:"My Account",exact:true}).waitFor();assert.ok(await page.getByText("Welcome back, New Customer").isVisible());
 await page.getByRole("button",{name:"Logout",exact:true}).click();await page.getByLabel("Email",{exact:true}).waitFor();
 pass("customer signup validates confirmation, signs in, shows welcome/account actions, logs out");
 await page.getByLabel("Email",{exact:true}).fill(active.email);await page.getByLabel("Password",{exact:true}).fill("WrongPassword");await page.getByRole("button",{name:"Sign In",exact:true}).click();await page.locator("p[role=alert]").waitFor();
 await page.getByLabel("Password",{exact:true}).fill("Test123456");await page.getByRole("button",{name:"Sign In",exact:true}).click();await page.waitForURL(base+"/",{timeout:20000});
 await page.goto(base+"/sell");await page.waitForURL(/role=vendor&mode=signup/);await page.getByRole("button",{name:"Create Seller Account",exact:true}).waitFor();
 pass("password login and logged-in customer Sell on JORO opens basic seller signup");
 await page.close();
 page=await browser.newPage({extraHTTPHeaders:{"x-forwarded-for":"127.0.0."+ (++pageNumber)}});await page.goto(base+"/sell");await page.waitForURL(/role=vendor&mode=signup/);await page.getByLabel("Full Name",{exact:true}).fill("New Seller");const vendorEmail=run+"-newvendor@example.invalid";
 await page.getByLabel("Email",{exact:true}).fill(vendorEmail);await page.getByLabel("Mobile Number",{exact:true}).fill("0301-1234567");await page.getByLabel("Password",{exact:true}).fill("Test123456");await page.getByLabel("Confirm Password",{exact:true}).fill("Test123456");await page.getByRole("button",{name:"Create Seller Account",exact:true}).click();await page.waitForURL(base+"/vendor/onboarding",{timeout:20000});
 const draft=await db.vendor.findUniqueOrThrow({where:{email:vendorEmail}});vendors.push(draft.id);assert.equal(draft.status,"onboarding");assert.equal(draft.cnic,null);assert.equal(draft.bankName,"");
 assert.equal((await json(page,"/api/vendor/store")).status(),401);
 const adminToken=await encode({secret,token:{sub:"admin",email:"test-admin@example.invalid",name:"Test Admin",role:"admin"},maxAge:3600});
 const adminHeaders={Origin:base,cookie:"__Secure-next-auth.session-token.admin="+adminToken};
 assert.equal((await page.request.patch(base+"/api/admin/vendors/"+draft.id,{headers:adminHeaders,data:{action:"approve"}})).status(),409);
 assert.equal((await page.request.post(base+"/api/vendor/onboarding",{multipart:{name:"Incomplete"},headers:{Origin:base}})).status(),400);
 await page.goto(base+"/login?role=vendor");await page.getByRole("link",{name:"Continue Seller Setup",exact:true}).waitFor();await page.getByRole("button",{name:"Logout",exact:true}).click();await page.getByLabel("Email",{exact:true}).waitFor();await page.close();
 page=await browser.newPage({extraHTTPHeaders:{"x-forwarded-for":"127.0.0."+ (++pageNumber)}});await vendorLogin(page,vendorEmail);await page.waitForURL(base+"/vendor/onboarding");
 await page.getByLabel("Store Name",{exact:true}).fill("Test Shop");await page.getByLabel("Primary Product Category",{exact:true}).fill("Electronics");await page.getByLabel("Store / Business Description",{exact:true}).fill("A trusted seller offering quality electronics.");await page.getByLabel("Contact Number",{exact:true}).fill("0300-1234567");await page.getByLabel("Business Address",{exact:true}).fill("123 Test Street");await page.getByLabel("City",{exact:true}).fill("Lahore");await page.getByLabel("Province / Region",{exact:true}).fill("Punjab");await page.getByRole("button",{name:"Save & Continue",exact:true}).click();await page.getByText("Progress saved.",{exact:false}).waitFor();
 await page.reload();await page.getByRole("button",{name:"1. Store & Business",exact:true}).click();assert.equal(await page.getByLabel("Store Name",{exact:true}).inputValue(),"Test Shop");await page.getByRole("button",{name:"2. Identity / KYC",exact:true}).click();
 await page.getByLabel("Legal Full Name",{exact:true}).fill("New Seller");await page.getByLabel("CNIC Number",{exact:true}).fill("54321-1234567-1");
 const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfRsAAAAASUVORK5CYII=","base64");
 for(const label of ["CNIC front","CNIC back"])await page.getByLabel(label,{exact:true}).setInputFiles({name:"fixture.png",mimeType:"image/png",buffer:png});
 await page.getByRole("button",{name:"Save & Continue",exact:true}).click();
 await page.getByText("Progress saved.",{exact:false}).waitFor();
 assert.equal(await db.vendorDocument.count({where:{vendorId:draft.id}}),2);
 await page.getByRole("button",{name:"Use business address for pickup",exact:true}).click();await page.getByRole("button",{name:"Save & Continue",exact:true}).click();await page.getByText("Progress saved.",{exact:false}).waitFor();
 await page.getByLabel("Account Title",{exact:true}).fill("Test Seller");await page.getByLabel("Bank Name",{exact:true}).fill("Test Bank");await page.getByLabel("Account Number",{exact:true}).fill("123456789");await page.getByRole("button",{name:"Save & Continue",exact:true}).click();await page.getByText("Progress saved.",{exact:false}).waitFor();
 await page.getByLabel("I confirm that the submitted business, identity, address and payout details are accurate.",{exact:true}).check();
 await page.getByRole("button",{name:"Submit for Approval",exact:true}).click();await page.waitForURL(base+"/vendor/status",{timeout:20000});assert.equal((await db.vendor.findUniqueOrThrow({where:{id:draft.id}})).status,"pending");
 assert.equal((await json(page,"/api/vendor/store")).status(),401);
 await page.goto(base+"/vendor/dashboard");await page.waitForURL(base+"/vendor/status");
 await page.goto(base+"/sell");await page.waitForURL(base+"/vendor/status");
 assert.equal((await page.request.patch(base+"/api/admin/vendors/"+draft.id,{headers:adminHeaders,data:{action:"approve"}})).status(),200);
 assert.equal((await db.vendor.findUniqueOrThrow({where:{id:draft.id}})).status,"approved");
 assert.equal((await json(page,"/api/vendor/store")).status(),200);
 pass("basic seller signup/relogin, persisted fields/documents, incomplete approval rejection, pending restrictions and explicit admin approval");
 await page.close();
 for(const vendor of statusVendors){page=await browser.newPage({extraHTTPHeaders:{"x-forwarded-for":"127.0.0."+ (++pageNumber)}});await vendorLogin(page,vendor.email);
  if(vendor.status==="suspended"){await page.locator("p[role=alert]").waitFor();assert.ok((await page.locator("p[role=alert]").innerText()).includes("Account suspended"));}
  else {const target=vendor.status==="approved"?"/vendor/dashboard":vendor.status==="pending"?"/vendor/status":"/vendor/onboarding";const label=vendor.status==="approved"?"Go to Vendor Dashboard":vendor.status==="pending"?"View Application Status":"Correct Seller Application";await page.waitForURL(base+target,{timeout:20000});await page.goto(base+"/login?role=vendor");await page.getByRole("link",{name:label,exact:true}).waitFor();await page.goto(base+"/sell");await page.waitForURL(base+target);}
  assert.equal((await db.vendor.findUniqueOrThrow({where:{id:vendor.id}})).status,vendor.status);await page.close();}
 pass("existing approved/pending/rejected/suspended statuses and entry behavior preserved");
 await start(true);
 const configured=await (await fetch(base+"/api/auth/providers")).json();assert.ok(configured.google&&configured.credentials);
 pass("Google provider registration is active");
 for(const width of [360,390,768,1024,1280,1440]){
  page=await browser.newPage({viewport:{width,height:768}});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  for(const role of ["customer","vendor"])for(const mode of ["signin","signup"]){
   await ready(page,role,mode);await noOverflow(page,width+" "+role+" "+mode);
   assert.equal(await page.getByRole("button",{name:"Continue with Google",exact:true}).count(),role==="customer"?1:0);
   assert.equal(await page.getByLabel("Confirm Password",{exact:true}).count(),mode==="signup"?1:0);
   const layout=await page.evaluate(()=>({height:document.documentElement.scrollHeight,viewport:innerHeight,nested:Array.from(document.querySelectorAll("main *")).filter(e=>{const s=getComputedStyle(e);return ["auto","scroll"].includes(s.overflowY)&&e.scrollHeight>e.clientHeight+1;}).length}));
   if(width>=1024)assert.ok(layout.height<=layout.viewport+1,JSON.stringify({width,role,mode,layout}));
   assert.equal(layout.nested,0);
   if(mode==="signup"&&role==="customer"&&[390,1280].includes(width))await page.screenshot({path:path.join(snapshots,"auth-"+width+".png"),fullPage:true});
  }
  assert.deepEqual(errors,[]);
  await page.goto(base+"/");await page.getByRole("button",{name:"Categories",exact:true}).waitFor();await noOverflow(page,width+" homepage");
  const trigger=page.getByRole("button",{name:"Categories",exact:true});await trigger.click();await page.getByRole("navigation",{name:"All categories",exact:true}).waitFor();await page.keyboard.press("Escape");assert.equal(await trigger.getAttribute("aria-expanded"),"false");await trigger.focus();await page.keyboard.press("ArrowDown");await page.getByRole("navigation",{name:"All categories",exact:true}).waitFor();await page.locator("header").first().click({position:{x:2,y:2}});assert.equal(await trigger.getAttribute("aria-expanded"),"false");
  await trigger.click();const real=await (await fetch(base+"/api/categories")).json();if(real.length){const link=page.getByRole("navigation",{name:"All categories",exact:true}).getByRole("link",{name:real[0].name,exact:true});assert.equal(await link.getAttribute("href"),"/products?category="+encodeURIComponent(real[0].name));await link.click();await page.waitForURL(/\/products\?category=/);}
  await noOverflow(page,width+" category products");
  if(width>=1024){await page.goto(base+"/");const action=page.locator("header div.order-3");const labels=await action.locator(":scope > a, :scope > button").evaluateAll(els=>els.map(e=>e.getAttribute("aria-label")||e.textContent?.trim()));assert.deepEqual(labels,["Wants","Together","Stores","Sell on JORO","Open cart","Account"]);}
  const footer=page.locator("footer");assert.ok((await footer.innerText()).includes("APNI MARKET • APNI CHOICE"));assert.ok(!(await footer.innerText()).includes("Secure Payments"));assert.ok(!(await footer.innerText()).includes("Customers aur"));
  assert.deepEqual(errors,[]);await page.close();pass(width+"px: four auth states, provider visibility, fit/overflow, categories keyboard/outside/link behavior and footer");
 }
 page=await browser.newPage({extraHTTPHeaders:{"x-forwarded-for":"127.0.0."+ (++pageNumber)}});await ready(page);await page.getByLabel("Password",{exact:true}).fill("clear-me");await page.getByRole("tab",{name:"Vendor",exact:true}).click();await page.getByRole("button",{name:"Sign In as Vendor",exact:true}).waitFor();assert.equal(await page.getByLabel("Password",{exact:true}).inputValue(),"");await page.getByRole("tab",{name:"Vendor",exact:true}).focus();await page.keyboard.press("ArrowRight");await page.getByRole("button",{name:"Sign In",exact:true}).waitFor();
 await page.goto(base+"/login?error=OAuthAccountNotLinked");await page.getByText("An account already exists with this email. Sign in using your existing method first.",{exact:true}).waitFor();
 await page.goto(base+"/login?error=AccessDenied");await page.getByText("Sign-in was cancelled or this account is unavailable.",{exact:true}).waitFor();pass("role switching clears secrets, keyboard tabs and safe OAuth errors");
 const token=await encode({secret,token:{sub:active.id,email:active.email,name:active.name,role:"customer",sessionVersion:0},maxAge:3600});
 await page.context().addCookies([{name:"__Secure-next-auth.session-token.customer",value:token,domain:"localhost",path:"/",secure:true,httpOnly:true,sameSite:"Lax"}]);
 assert.equal((await json(page,"/api/vendor/store")).status(),401);await page.goto(base+"/vendor/dashboard");await page.waitForURL(/\/login\?role=vendor/);await page.goto(base+"/admin");await page.waitForURL(/\/admin\/login/);pass("customer session cannot access vendor or admin context");
 await page.close();
 page=await browser.newPage({viewport:{width:1280,height:768}});
 await page.goto(base+"/");
 await page.evaluate(()=>localStorage.setItem("irb-cart",JSON.stringify([{productId:"local-cart-fixture",name:"Cart fixture",price:1,image:"",quantity:3,maxStock:10}])));
 await page.reload();
 await page.getByRole("button",{name:"Open cart",exact:true}).getByText("3",{exact:true}).waitFor();
 await page.evaluate(()=>localStorage.removeItem("irb-cart"));await page.reload();
 assert.equal(await page.getByRole("button",{name:"Open cart",exact:true}).getByText("3",{exact:true}).count(),0);
 await page.getByRole("button",{name:"Account",exact:true}).click();await page.waitForURL(/role=customer&mode=signin/);
 await page.getByLabel("Password",{exact:true}).fill("Visible123");const show=page.getByRole("button",{name:"Show password",exact:true});await show.focus();await page.keyboard.press("Enter");assert.equal(await page.getByLabel("Password",{exact:true}).getAttribute("type"),"text");
 await page.getByRole("button",{name:"Hide password",exact:true}).click();assert.equal(await page.getByLabel("Password",{exact:true}).getAttribute("type"),"password");
 pass("cart badge reflects stored quantity, account opens unified auth, password toggle is keyboard accessible");
 await page.close();console.log("Browser checks passed: "+count+"; screenshots: "+snapshots);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 await browser?.close();await stop();
 const ownedVendors=await db.vendor.findMany({where:{email:{startsWith:run}},select:{id:true}});
 for(const v of ownedVendors){const root=path.resolve("storage/private/vendor-docs"),target=path.resolve(root,v.id);assert.ok(target.startsWith(root+path.sep)&&!v.id.includes(path.sep));if(existsSync(target))rmSync(target,{recursive:true,force:true});}
 await db.adminAuditLog.deleteMany({where:{entityType:"Vendor",entityId:{in:ownedVendors.map(v=>v.id)}}});
 await db.vendor.deleteMany({where:{email:{startsWith:run}}});
 await db.customer.deleteMany({where:{email:{startsWith:run}}});
 await db.$disconnect();
});
