/** Run after npm run build. Uses only localhost DB/server and removes only this run's fixture IDs. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { existsSync, mkdirSync } from "node:fs";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { chromium, type Browser } from "playwright-core";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
const localHosts = ["localhost", "127.0.0.1", "[::1]"];
assert.ok(process.env.DATABASE_URL && localHosts.includes(new URL(process.env.DATABASE_URL).hostname), "Account tests require a local development database.");
assert.ok(existsSync(".next/BUILD_ID"), "Run npm run build first.");
const db = new PrismaClient(); const run = `together-test-${randomUUID()}`; const secret = randomUUID();
const port = 3117; const base = `http://localhost:${port}`;
let server: ReturnType<typeof spawn> | undefined; let browser: Browser | undefined;
const roomIds: string[] = []; const orderIds: string[] = [];
const customerIds: string[] = []; const vendorIds: string[] = []; const productIds: string[] = [];
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
  await db.$queryRaw`SELECT 1`;
  const customers = [];
  for (const suffix of ["a", "b", "outsider"]) {
    const customer = await db.customer.create({data:{email:`${run}-${suffix}@example.invalid`,name:`Family ${suffix}`,passwordHash:"not-a-password",phone:"03001234567"}});
    customers.push(customer); customerIds.push(customer.id);
  }
  const [a,b,c] = customers; const authA = await cookie(a); const authB = await cookie(b); const authC = await cookie(c);
  const vendor = await db.vendor.create({data:{shopName:"Family Fixture Store",ownerName:"Private owner",email:`${run}@example.invalid`,passwordHash:"not-a-password",phone:"03001234567",cnic:run,address:"Private address",city:"Lahore",businessType:"individual",bankName:"Private bank",accountNumber:"private-number",accountTitle:"Private title",status:"approved",storeSlug:run,primaryCategory:"Other"}}); vendorIds.push(vendor.id);
  const product = await db.product.create({data:{name:"Family Fixture Product",description:"Temporary fixture",price:100,category:"Other",stock:20,variants:["Black","Green"],listingImageUrls:["/joro-logo.svg"]}}); productIds.push(product.id);
  const otherProduct = await db.product.create({data:{name:"Existing Personal Product",description:"Temporary fixture",price:50,category:"Other",stock:20,variants:[]}}); productIds.push(otherProduct.id);
  const publication = await db.vendorProduct.create({data:{vendorId:vendor.id,productName:product.name,description:product.description,price:100,category:"Other",stock:20,images:[],status:"active",publishedProductId:product.id}});
  server = spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(port)],{windowsHide:true,stdio:"ignore",env:{...process.env,NODE_ENV:"production",NEXTAUTH_SECRET:secret,NEXTAUTH_URL:base,NEXTAUTH_URL_INTERNAL:base}});
  let ready=false; for(let i=0;i<60;i++){try{if((await fetch(`${base}/api/customer/profile`)).status===401){ready=true;break;}}catch{} if(server.exitCode!==null) throw new Error("Test server exited"); await delay(1000);} assert.ok(ready);
  await request("/api/together","","GET",undefined,401);
  const created = await request("/api/together",authA,"POST",{name:"Family E2E Room",ownerId:b.id}); const roomId=created.room.id; roomIds.push(roomId); const path=`/api/together/${roomId}`;
  const act=(auth:string,body:unknown,status=200)=>request(path,auth,"POST",body,status);
  assert.equal((await request(path,authA)).owner,true); pass("customer A creates and opens a room; forged owner ignored");
  const invite=await act(authA,{action:"invite"}); const token=invite.invitePath.split("/").pop(); assert.match(token,/^[a-f0-9]{64}$/); assert.notEqual((await db.roomInvite.findFirstOrThrow({where:{roomId}})).tokenHash,token);
  await request("/api/together/join",authB,"POST",{token}); await request("/api/together/join",authB,"POST",{token}); assert.equal(await db.roomMember.count({where:{roomId,customerId:b.id}}),1); pass("secure hashed invite, join and duplicate membership prevention");
  await request(path,authC,"GET",undefined,404); await act(authC,{action:"add",productId:product.id,quantity:1},404); await act(authB,{action:"invite",ownerId:a.id},403);
  await request("/api/together/join",authC,"POST",{token:"invalid"},400); await request("/api/together/join",authC,"POST",{token:"0".repeat(64)},404);
  await db.roomInvite.updateMany({where:{roomId},data:{expiresAt:new Date(0)}}); await request("/api/together/join",authC,"POST",{token},404);
  const revoked=await act(authA,{action:"invite"}); await act(authA,{action:"revoke"}); await request("/api/together/join",authC,"POST",{token:revoked.invitePath.split("/").pop()},404); pass("nonmember IDOR, owner impersonation, invalid/expired/revoked invites reject");
  const add={action:"add",productId:product.id,variant:"Black",quantity:2,price:1,vendorId:"forged"}; await act(authA,add); await act(authB,add);
  assert.equal(await db.roomItem.count({where:{roomId}}),1);
  await Promise.all([authA,authB].map(async auth => {
    const response = await fetch(`${base}${path}`, { method: "POST", headers: { cookie: auth, Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({...add,variant:"Green"}) });
    assert.ok([200,409].includes(response.status));
    if(response.status===409) await act(auth,{...add,variant:"Green"});
  }));
  assert.equal(await db.roomItem.count({where:{roomId,variant:"Green"}}),1);
  await act(authA,{...add,productId:"nonexistent"},409); await act(authA,{...add,variant:"Invalid"},400); pass("real products, selected variants, sequential and concurrent duplicates");
  const item=await db.roomItem.findFirstOrThrow({where:{roomId,variant:"Black"}});
  for(const text of ["First comment","Second comment","Third comment"]) await act(authA,{action:"comment",itemId:item.id,text,memberId:"forged"});
  await act(authB,{action:"comment",itemId:item.id,text:"B independent comment"});
  assert.equal(await db.roomComment.count({where:{itemId:item.id}}),4);
  const comments=await db.roomComment.findMany({where:{itemId:item.id},orderBy:{createdAt:"asc"}}); const comment=comments[0];
  await act(authB,{action:"editComment",itemId:item.id,commentId:comment.id,text:"forged",memberId:comment.memberId},404);
  await act(authB,{action:"deleteComment",itemId:item.id,commentId:comment.id},404);
  const ownB=comments.find(row=>row.memberId!==comment.memberId)!; await act(authA,{action:"editComment",itemId:item.id,commentId:ownB.id,text:"owner impersonation"},404); await act(authA,{action:"deleteComment",itemId:item.id,commentId:ownB.id},404);
  await act(authA,{action:"editComment",itemId:item.id,commentId:comment.id,text:"Edited first"}); await act(authA,{action:"deleteComment",itemId:item.id,commentId:comments[1].id});
  assert.equal((await db.roomComment.findUniqueOrThrow({where:{id:comment.id}})).text,"Edited first"); assert.equal(await db.roomComment.count({where:{itemId:item.id}}),3);
  for(const text of ["   ","<script>alert(1)</script>","x".repeat(2001)]) await act(authA,{action:"comment",itemId:item.id,text},400);
  await act(authA,{action:"comment",itemId:item.id,text:"<b>Safe text</b><script>bad()</script>"}); assert.ok(await db.roomComment.findFirst({where:{itemId:item.id,text:"Safe text"}})); pass("multiple independent comments, own edits/deletes, owner and member isolation, text sanitation");
  const cart={action:"cart",itemIds:[item.id],quantity:3,price:1,customerId:a.id};
  await db.product.update({where:{id:product.id},data:{price:175}}); const line=(await act(authB,cart)).lines[0]; assert.equal(line.price,175); assert.equal(line.variant,"Black"); assert.equal(line.productId,product.id); assert.equal(line.quantity,3); assert.equal(line.image,"/joro-logo.svg");
  await act(authC,cart,404); await act(authB,{...cart,itemIds:["forged"]},404); await act(authB,{...cart,quantity:0},400);
  await db.product.update({where:{id:product.id},data:{stock:2}}); await act(authB,cart,409);
  await db.product.update({where:{id:product.id},data:{stock:20,isActive:false}}); await act(authB,cart,409);
  await db.product.update({where:{id:product.id},data:{isActive:true}}); await db.vendorProduct.update({where:{id:publication.id},data:{stock:0}}); await act(authB,cart,409);
  await db.vendorProduct.update({where:{id:publication.id},data:{stock:20}}); await db.vendor.update({where:{id:vendor.id},data:{status:"suspended"}}); await act(authB,cart,409); await db.vendor.update({where:{id:vendor.id},data:{status:"approved"}}); pass("cart uses current price, stock, variant and eligible vendor; forged customer/item ignored");
  await db.customerAddress.create({ data: { customerId: b.id, label: "Private home", recipientName: b.name, phone: b.phone, address: "Private delivery", city: "Lahore" } });
  assert.equal((await request(`/api/customer/addresses?customerId=${b.id}`,authA)).addresses.length,0);
  assert.equal((await request(`/api/customer/addresses`,authB)).addresses.length,1);
  const privateOrder = await db.order.create({ data: { orderNumber: `${run}-private`, customerId: b.id, customerName: b.name, customerPhone: b.phone, customerEmail: b.email, customerAddress: "Private delivery", city: "Lahore", totalAmount: 50, paymentMethod: "cod", paymentStatus: "pending", orderStatus: "pending", orderItems: { create: { productId: otherProduct.id, name: otherProduct.name, price: 50, quantity: 1 } } } }); orderIds.push(privateOrder.id);
  await request(`/api/customer/orders/${privateOrder.id}`,authA,"GET",undefined,404);
  await request(`/api/customer/orders/${privateOrder.id}`,authB);
  await db.savedProduct.create({data:{customerId:b.id,productId:otherProduct.id}});
  assert.equal((await request(`/api/customer/saved-products?customerId=${b.id}`,authA)).products.length,0);
  assert.equal((await request("/api/customer/saved-products",authB)).products.length,1);
  const room=await request(path,authB); const json=JSON.stringify(room);
  for(const privateValue of [a.email,b.email,a.phone,"Private address","private-number","passwordHash","votes","priceAtAddition"]) assert.ok(!json.includes(privateValue));
  assert.equal(room.room.items[0].product.vendorPublication.vendor.storeSlug,run);
  const list=await request("/api/together",authA); const listed=list.rooms.find((r:{id:string})=>r.id===roomId); assert.equal(listed._count.members,2); assert.equal(listed._count.items,2); assert.equal(listed.members[0].role,"OWNER"); assert.equal((await request("/api/together",authC)).rooms.length,0); pass("private fields excluded; canonical store slug and account counts");
  browser=await chromium.launch({executablePath:process.env.ACCOUNT_TEST_BROWSER||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",headless:true});
  const joinInvite = await act(authA,{action:"invite"});
  const context=await browser.newContext(); await context.addCookies([{name:"__Secure-next-auth.session-token.customer",value:authB.split("=")[1],domain:"localhost",path:"/",secure:true,httpOnly:true,sameSite:"Lax"}]);
  const ownerContext = await browser.newContext();
  await ownerContext.addCookies([{name:"__Secure-next-auth.session-token.customer",value:authA.split("=")[1],domain:"localhost",path:"/",secure:true,httpOnly:true,sameSite:"Lax"}]);
  const ownerPage = await ownerContext.newPage();
  const ownerReady = ownerPage.waitForResponse(response => new URL(response.url()).pathname === "/api/together" && response.request().method() === "GET" && response.ok());
  await ownerPage.goto(`${base}/together/new`); await ownerReady;
  await ownerPage.getByLabel("Shopping room name").fill("Browser Created Family Cart");
  await ownerPage.getByRole("button",{name:"Create room",exact:true}).click();
  await ownerPage.waitForURL(/\/together\/(?!new)[^/]+$/);
  const browserRoomId = new URL(ownerPage.url()).pathname.split("/").pop()!; roomIds.push(browserRoomId);
  await ownerPage.getByRole("button",{name:"Copy Invite Link",exact:true}).click();
  await ownerPage.getByLabel("Invitation link",{exact:true}).waitFor();
  const browserInvite = await ownerPage.getByLabel("Invitation link",{exact:true}).inputValue();
  await ownerPage.getByLabel("Product link or ID").fill(`${base}/products/${product.id}`);
  await ownerPage.getByLabel("Variant (if applicable)").fill("Black");
  await ownerPage.getByRole("button",{name:"Add product",exact:true}).click();
  await ownerPage.getByRole("heading",{name:product.name,exact:true}).waitFor();
  for(const text of ["Browser owner first","Browser owner second"]){await ownerPage.getByLabel("Add a comment",{exact:true}).fill(text);await ownerPage.getByRole("button",{name:"Post comment"}).click();await ownerPage.getByText(text,{exact:true}).waitFor();}
  const joinPage = await context.newPage(); await joinPage.goto(browserInvite); await joinPage.waitForURL(`**/together/${browserRoomId}`);
  await joinPage.getByText("Browser owner first",{exact:true}).waitFor(); await joinPage.getByText("Browser owner second",{exact:true}).waitFor();
  await joinPage.getByRole("button",{name:"Add to My Cart",exact:true}).click(); await joinPage.getByRole("status").filter({hasText:"Added to your cart"}).waitFor();
  assert.equal(await db.roomMember.count({where:{roomId:browserRoomId}}),2);
  await joinPage.close(); await ownerContext.close(); pass("browser-only create, copy invite, first join, share real product, multiple comments and personal-cart flow");
  const page=await context.newPage(); const pageErrors:string[]=[]; page.on("pageerror",e=>pageErrors.push(`${page.url()}: ${e.message}`));
  await page.goto(`${base}${joinInvite.invitePath}`); await page.waitForURL(`**/together/${roomId}`); await page.getByRole("heading",{name:"Family E2E Room",exact:true}).waitFor();
  await page.evaluate(({id,other})=>localStorage.setItem(`irb-cart:customer:${id}`,JSON.stringify([{productId:other,name:"Existing Personal Product",price:50,quantity:3,image:"",maxStock:20}])),{id:b.id,other:otherProduct.id}); await page.reload(); await page.getByRole("heading",{name:"Family E2E Room",exact:true}).waitFor();
  const blackCard=page.locator("article").filter({hasText:"Black"}); await blackCard.getByRole("button",{name:"Add to My Cart",exact:true}).click(); await page.getByRole("status").filter({hasText:"Added to your cart"}).waitFor();
  const readCart=()=>page.evaluate(id=>JSON.parse(localStorage.getItem(`irb-cart:customer:${id}`)||"[]"),b.id);
  let stored=await readCart(); assert.equal(stored.length,2); assert.equal(stored.find((r:{productId:string})=>r.productId===otherProduct.id).quantity,3); assert.equal(stored.find((r:{productId:string})=>r.productId===product.id).variant,"Black");
  await blackCard.getByRole("button",{name:"Add to My Cart",exact:true}).click(); await page.getByRole("status").filter({hasText:"Added to your cart"}).waitFor(); stored=await readCart(); assert.equal(stored.find((r:{productId:string})=>r.productId===product.id).quantity,4); pass("browser Add to My Cart preserves existing lines and accumulates exact variant quantity");
  await blackCard.getByLabel("Add a comment",{exact:true}).fill("Browser comment one"); await blackCard.getByRole("button",{name:"Post comment"}).click(); await blackCard.getByText("Browser comment one",{exact:true}).waitFor();
  await blackCard.getByLabel("Add a comment",{exact:true}).fill("Browser comment two"); await blackCard.getByRole("button",{name:"Post comment"}).click(); await blackCard.getByText("Browser comment two",{exact:true}).waitFor(); assert.equal(await blackCard.getByText("Browser comment one",{exact:true}).count(),1);
  const browserComment=blackCard.locator("li").filter({hasText:"Browser comment two"}); await browserComment.getByRole("button",{name:"Edit",exact:true}).click(); await browserComment.getByLabel("Edit comment").fill("Browser edited"); await browserComment.getByRole("button",{name:"Save comment"}).click(); await blackCard.getByText("Browser edited",{exact:true}).waitFor(); await blackCard.locator("li").filter({hasText:"Browser edited"}).getByRole("button",{name:"Delete",exact:true}).click(); await blackCard.getByText("Browser edited",{exact:true}).waitFor({state:"detached"}); pass("browser multiple comments and own edit/delete controls");
  mkdirSync("coverage/family-cart",{recursive:true});
  for(const width of [360,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    for(const destination of [`/together/${roomId}`,"/account/together"]){await page.goto(`${base}${destination}`); await page.getByText("Family E2E Room",{exact:true}).waitFor(); if(destination.includes("account")) assert.equal(await page.getByRole("navigation",{name:"My JORO account"}).getByRole("link",{name:"Family Cart",exact:true}).getAttribute("aria-current"),"page"); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`overflow ${width} ${destination}`); await page.screenshot({path:`coverage/family-cart/${destination.includes("account") ? "account" : "room"}-${width}.png`,fullPage:true});}
  } pass("room and account responsive at 360/390/768/1024/1440");
  await page.goto(`${base}/together/${roomId}`); await page.getByRole("link",{name:"View Product",exact:true}).first().click(); await page.waitForURL(`**/products/${product.id}`); await page.getByRole("heading",{name:product.name,exact:true}).waitFor();
  await page.goto(`${base}/together/${roomId}`); await page.getByRole("link",{name:"View Store",exact:true}).first().click(); await page.waitForURL(`**/stores/${run}`); await page.getByRole("heading",{name:vendor.shopName,exact:true}).waitFor(); pass("canonical product and store links work");
  await context.clearCookies(); await context.addCookies([{name:"__Secure-next-auth.session-token.customer",value:authA.split("=")[1],domain:"localhost",path:"/",secure:true,httpOnly:true,sameSite:"Lax"}]); await page.goto(`${base}/cart`); await page.waitForFunction(()=>!document.body.textContent?.includes("Loading")); assert.ok(!(await page.locator("main").innerText()).includes("Existing Personal Product")); assert.equal((await readCart()).length,2); pass("same-browser customer switch hides B cart from A and preserves B storage");
  assert.deepEqual(pageErrors,[]); await context.close();
  const anonymous=await browser.newContext(); const anonPage=await anonymous.newPage(); await anonPage.goto(`${base}${invite.invitePath}`); await anonPage.getByRole("button",{name:"Join room",exact:true}).click(); await anonPage.waitForURL(url=>url.pathname==="/login"&&url.searchParams.get("callbackUrl")===`/join/${token}`,{timeout:20000}); await anonPage.getByRole("heading",{name:"Welcome Back",exact:true}).waitFor(); assert.ok(!(await anonPage.locator("body").innerText()).includes("Family E2E Room")); await anonymous.close(); pass("anonymous invite opens sign-in without leaking room contents");
  await act(authB,{action:"remove",itemId:item.id},403); await act(authA,{action:"remove",itemId:item.id}); assert.equal(await db.roomComment.count({where:{itemId:item.id}}),0); pass("owner can remove shared product; member cannot");
  console.log(`Family Cart E2E passed: ${checks} groups.`);
}
async function cleanup(){
  await browser?.close().catch(()=>undefined); server?.kill();
  await db.roomItem.deleteMany({where:{roomId:{in:roomIds}}});
  await db.roomInvite.deleteMany({where:{roomId:{in:roomIds}}});
  await db.roomMember.deleteMany({where:{roomId:{in:roomIds}}});
  await db.shoppingRoom.deleteMany({where:{id:{in:roomIds}}});
  await db.order.deleteMany({where:{id:{in:orderIds}}});
  await db.savedProduct.deleteMany({where:{customerId:{in:customerIds}}});
  await db.vendorProduct.deleteMany({where:{vendorId:{in:vendorIds}}});
  await db.product.deleteMany({where:{id:{in:productIds}}});
  await db.vendor.deleteMany({where:{id:{in:vendorIds}}});
  await db.customerAddress.deleteMany({where:{customerId:{in:customerIds}}});
  await db.customer.deleteMany({where:{id:{in:customerIds}}});
  await db.$disconnect(); console.log("Temporary Family Cart fixtures removed.");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(cleanup);
