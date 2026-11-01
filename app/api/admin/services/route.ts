import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { listingData } from "@/lib/service-management";
import { validateCoverage } from "@/lib/service-locations";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const auth=await requireAdminPermission("moderation.manage");if("response" in auth)return auth.response;
 return api(async()=>{
  const q=new URL(request.url).searchParams;
  const {page,search,status}=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),search:z.string().max(100).default(""),status:z.enum(["","PENDING_APPROVAL","APPROVED","REJECTED","HIDDEN"]).default("")}).parse(Object.fromEntries(q));
  const where:Prisma.ServiceOfferingWhereInput={...(status?{moderationStatus:status}:{}),...(search?{OR:[{name:{contains:search}},{type:{contains:search}},{vendor:{shopName:{contains:search}}}]}:{})};
  const [services,total,stats,catalog,vendors,locationRequests]=await Promise.all([
   prisma.serviceOffering.findMany({where,orderBy:[{submittedAt:"desc"},{id:"desc"}],skip:(page-1)*20,take:20,include:{catalog:true,vendor:{select:{id:true,shopName:true,status:true}}}}),
   prisma.serviceOffering.count({where}),prisma.serviceOffering.groupBy({by:["moderationStatus"],_count:{_all:true}}),
   prisma.serviceCatalog.findMany({orderBy:[{category:"asc"},{name:"asc"}],take:1000}),
   prisma.vendor.findMany({where:{status:"approved",...(q.get("vendorSearch")?{shopName:{contains:q.get("vendorSearch")!.slice(0,100)}}:{})},select:{id:true,shopName:true,city:true},orderBy:{shopName:"asc"},take:100}),
   prisma.serviceLocationRequest.findMany({where:{status:"OPEN"},orderBy:{createdAt:"desc"},take:100})]);
  return {services,total,page,pageSize:20,stats,catalog,vendors,locationRequests};
 });
}
export async function POST(request:Request){
 const auth=await requireAdminPermission("moderation.manage");if("response" in auth)return auth.response;
 return api(async()=>{sameOrigin(request);const body=await request.json();const vendorId=z.string().min(1).parse(body.vendorId);
  return prisma.$transaction(async tx=>{
   if(!await tx.vendor.findFirst({where:{id:vendorId,status:"approved"},select:{id:true}}))throw new ApiError(400,"Choose an approved vendor.");
   const {data,existing}=await listingData(tx,body,vendorId,true);
   const approved={...data,moderationStatus:"APPROVED",reviewedBy:auth.admin.id,reviewedAt:new Date()};
   const service=existing?await tx.serviceOffering.update({where:{id:existing.id},data:approved}):await tx.serviceOffering.create({data:{...approved,vendorId,createdByAdmin:auth.admin.id}});
   await writeAdminAudit(tx,{adminId:auth.admin.id,action:existing?"service_updated_by_admin":"service_created_for_vendor",entityType:"ServiceOffering",entityId:service.id,details:{vendorId,catalogId:service.catalogId}});return {service};
  },{isolationLevel:"Serializable"});
 });
}
export async function PATCH(request:Request){
 const auth=await requireAdminPermission("moderation.manage");if("response" in auth)return auth.response;
 return api(async()=>{sameOrigin(request);const input=z.object({id:z.string().min(1),action:z.enum(["approve","reject","hide","restore","review-location"]),reason:z.string().trim().min(3).max(1000),version:z.string().optional()}).parse(await request.json());
  return prisma.$transaction(async tx=>{
   if(input.action==="review-location"){
    const result=await tx.serviceLocationRequest.updateMany({where:{id:input.id,status:"OPEN"},data:{status:"REVIEWED",reviewNote:input.reason,reviewedBy:auth.admin.id}});
    if(!result.count)throw new ApiError(404,"Open location request not found.");
    await writeAdminAudit(tx,{adminId:auth.admin.id,action:"service_location_reviewed",entityType:"ServiceLocationRequest",entityId:input.id,details:{reason:input.reason}});return {success:true};
   }
   const current=await tx.serviceOffering.findUnique({where:{id:input.id},include:{vendor:{select:{status:true}},catalog:{select:{active:true}}}});
   if(!current)throw new ApiError(404,"Service not found.");
   if(input.version!==current.updatedAt.toISOString())throw new ApiError(409,"Submission changed. Reload before reviewing.");
   const allowed=input.action==="approve"||input.action==="reject"?current.moderationStatus==="PENDING_APPROVAL":input.action==="restore"?current.moderationStatus==="HIDDEN":current.moderationStatus==="APPROVED";
   if(!allowed)throw new ApiError(409,"Action does not match current listing status.");
   if(["approve","restore"].includes(input.action)&&(current.vendor.status!=="approved"||current.catalog?.active===false))throw new ApiError(409,"Provider and catalog service must be active and approved.");
   if(input.action==="approve" || (input.action==="restore" && current.coverage!=null)) validateCoverage(current.coverage);
   const status=input.action==="reject"?"REJECTED":input.action==="hide"?"HIDDEN":"APPROVED";
   const service=await tx.serviceOffering.update({where:{id:input.id},data:{moderationStatus:status,moderationReason:input.reason,reviewedBy:auth.admin.id,reviewedAt:new Date()}});
   await writeAdminAudit(tx,{adminId:auth.admin.id,action:`service_${input.action}`,entityType:"ServiceOffering",entityId:input.id,details:{from:current.moderationStatus,to:status,reason:input.reason}});return {service};
  },{isolationLevel:"Serializable"});
 });
}
