/** Local database regression: cleans only unique IDs created by this run. */
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {config} from "dotenv";
config({path:".env.local",quiet:true});config({path:".env",quiet:true});
assert.ok(process.env.DATABASE_URL&&["localhost","127.0.0.1","[::1]"].includes(new URL(process.env.DATABASE_URL).hostname),"Local database required");
const run="pre10-"+randomUUID();
const vendorIds:string[]=[];
async function main(){
 const {prisma}=await import("../lib/prisma");
 const {resolveCustomerOAuth,CustomerOAuthError}=await import("../lib/customer-oauth");
 const {customerProviderAvailability}=await import("../lib/auth-provider-config");

 let checks=0;const pass=(label:string)=>console.log("PASS "+(++checks)+": "+label);
 try {
  const saved={google:process.env.GOOGLE_CLIENT_ID,googleSecret:process.env.GOOGLE_CLIENT_SECRET,facebook:process.env.FACEBOOK_CLIENT_ID,facebookSecret:process.env.FACEBOOK_CLIENT_SECRET};
  process.env.GOOGLE_CLIENT_ID="";process.env.GOOGLE_CLIENT_SECRET="";process.env.FACEBOOK_CLIENT_ID="";process.env.FACEBOOK_CLIENT_SECRET="";
  assert.deepEqual(customerProviderAvailability(),{google:false});
  process.env.GOOGLE_CLIENT_ID="fixture";process.env.FACEBOOK_CLIENT_ID="fixture";
  assert.deepEqual(customerProviderAvailability(),{google:false});
  process.env.GOOGLE_CLIENT_SECRET="fixture";
  assert.deepEqual(customerProviderAvailability(),{google:true});
  pass("providers require both credentials and can be independently configured");
  const {vendorSetupSchema,submitVendorSetup}=await import("../lib/vendor-onboarding");
  const {customerAuthOptions}=await import("../lib/customer-auth-options");
  assert.ok(!customerAuthOptions.providers.some(p=>p.id==="facebook"));assert.ok(customerAuthOptions.providers.some(p=>p.id==="google"));
  const cb=customerAuthOptions.callbacks!;
  for(const provider of ["google"] as const){
   const id=run+"-"+provider;const profile={...(provider==="google"?{sub:id,email_verified:true}:{id}),email:id+"@example.invalid",name:"OAuth Customer"};
   const first=await resolveCustomerOAuth({provider,providerAccountId:id,profile});
   const repeated=await Promise.all([resolveCustomerOAuth({provider,providerAccountId:id,profile}),resolveCustomerOAuth({provider,providerAccountId:id,profile})]);assert.ok(repeated.every(c=>c.id===first.id));
   assert.equal(await prisma.customer.count({where:{email:profile.email}}),1);
   const changed=await resolveCustomerOAuth({provider,providerAccountId:id,profile:{...profile,email:run+"-different@example.invalid"}});assert.equal(changed.id,first.id);
   const token=await cb.jwt!({token:{},account:{provider,providerAccountId:id},user:{id:"provider-id"}} as any);
   assert.equal(token.sub,first.id);assert.equal(token.role,"customer");
   await assert.rejects(resolveCustomerOAuth({provider,providerAccountId:id+"-bad",profile}),e=>e instanceof CustomerOAuthError&&e.code==="AccessDenied");
   await prisma.customer.update({where:{id:first.id},data:{isActive:false}});
   await assert.rejects(resolveCustomerOAuth({provider,providerAccountId:id,profile}),e=>e instanceof CustomerOAuthError&&e.code==="AccessDenied");
   await prisma.customer.update({where:{id:first.id},data:{isActive:true}});
   pass(provider+": new/repeated identity, stable customer mapping, customer-only JWT and inactive rejection");
  }
    const collision=await prisma.customer.create({data:{name:"Existing",email:run+"-collision@example.invalid",passwordHash:"existing-password"}});
  const provider="google" as const;
  const id=run+"-collision-"+provider;const profile={sub:id,email_verified:true,email:collision.email};
  const result=await resolveCustomerOAuth({provider,providerAccountId:id,profile});
  assert.equal(result.id,collision.id);
  assert.equal((await prisma.customerOAuthAccount.count({where:{customerId:collision.id}})),1);
  pass("Google verified emails link existing customers");
  await assert.rejects(resolveCustomerOAuth({provider:"google",providerAccountId:run+"-unverified",profile:{sub:run+"-unverified",email:run+"-unverified@example.invalid",email_verified:false}}));
  pass("unverified Google email rejects cleanly");
  const raceId=run+"-race";const race=await Promise.all([1,2,3].map(()=>resolveCustomerOAuth({provider:"google",providerAccountId:raceId,profile:{sub:raceId,email:raceId+"@example.invalid",email_verified:true}})));assert.equal(new Set(race.map(c=>c.id)).size,1);
  pass("concurrent first OAuth callbacks create one customer/identity");
  const vendors=await Promise.all((["approved","pending","rejected","suspended","onboarding"] as const).map(status=>prisma.vendor.create({data:{email:run+"-"+status+"@example.invalid",ownerName:"Fixture Seller",passwordHash:"fixture",address:"",status}})));
  vendorIds.push(...vendors.map(v=>v.id));const draft=vendors.find(v=>v.status==="onboarding")!;
  assert.equal(draft.cnic,null);assert.equal(draft.bankName,"");
  assert.equal(vendorSetupSchema.safeParse({name:"Only name"}).success,false);
  const input=vendorSetupSchema.parse({storeSlug:run,shopDescription:"Local fixture store description",province:"Punjab",pickupAddress:"123 Test Street",pickupCity:"Lahore",pickupProvince:"Punjab",pickupContactName:"Seller Owner",pickupPhone:"0300-1234567",returnSameAsPickup:true,declarationAccepted:true,name:"Seller Owner",shopName:"Seller Shop",phone:"0300-1234567",city:"Lahore",address:"123 Test Street",businessType:"individual",cnic:"12345-1234567-1",category:"Electronics",bankName:"Test Bank",accountTitle:"Seller Owner",accountNumber:"123456789"});
  await assert.rejects(submitVendorSetup(draft.id,input));
  await prisma.vendorDocument.createMany({data:["cnic_front","cnic_back"].map(documentType=>({vendorId:draft.id,documentType:documentType as "cnic_front"|"cnic_back",fileUrl:run+"/fixture.png"}))});
  await submitVendorSetup(draft.id,input);
  assert.equal((await prisma.vendor.findUniqueOrThrow({where:{id:draft.id}})).status,"pending");
  await assert.rejects(submitVendorSetup(draft.id,input));
  for(const vendor of vendors.filter(v=>v.id!==draft.id))assert.equal((await prisma.vendor.findUniqueOrThrow({where:{id:vendor.id}})).status,vendor.status);
  pass("basic seller defaults, incomplete/docless rejection, submission to pending and existing status preservation");
  const company=await prisma.vendor.create({data:{email:run+"-company@example.invalid",ownerName:"Company Owner",passwordHash:"fixture",address:"",status:"onboarding"}});
  vendorIds.push(company.id);
  const companyInput=vendorSetupSchema.parse({...input,storeSlug:run+"-company",businessLegalName:"Fixture Company",businessType:"company",businessRegNo:"REG123",cnic:"12345-1234567-2"});
  await prisma.vendorDocument.createMany({data:["cnic_front","cnic_back"].map(documentType=>({vendorId:company.id,documentType:documentType as "cnic_front"|"cnic_back",fileUrl:run+"/fixture.png"}))});
  await assert.rejects(submitVendorSetup(company.id,companyInput));
  await prisma.vendorDocument.create({data:{vendorId:company.id,documentType:"license",fileUrl:run+"/license.png"}});
  await submitVendorSetup(company.id,companyInput);
  assert.equal((await prisma.vendor.findUniqueOrThrow({where:{id:company.id}})).status,"pending");
  pass("company setup additionally requires the existing registration number and business license");
  assert.equal(await prisma.vendor.count({where:{email:{startsWith:run+"-google"}}}),0);
  pass("OAuth never creates vendor records");
  Object.assign(process.env,{GOOGLE_CLIENT_ID:saved.google||"",GOOGLE_CLIENT_SECRET:saved.googleSecret||"",FACEBOOK_CLIENT_ID:saved.facebook||"",FACEBOOK_CLIENT_SECRET:saved.facebookSecret||""});
  console.log("Pre-Step-10 service checks passed: "+checks);
 } finally {
  await prisma.vendor.deleteMany({where:{id:{in:vendorIds}}});
  await prisma.customer.deleteMany({where:{email:{startsWith:run}}});
  await prisma.$disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
