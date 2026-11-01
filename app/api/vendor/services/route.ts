import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { SERVICE_TYPES } from "@/lib/service-types";
import { listingData } from "@/lib/service-management";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => {
 const s = await getVendorFromSession(); if (!s) throw new ApiError(401, "Vendor sign-in required.");
 const [services, products, addons, bookingCount, catalog] = await Promise.all([
  prisma.serviceOffering.findMany({where:{vendorId:s.vendor.id},include:{catalog:true},orderBy:{createdAt:"desc"},take:100}),
  prisma.product.findMany({where:{vendorPublication:{vendorId:s.vendor.id}},select:{id:true,name:true},take:500}),
  prisma.productServiceAddon.findMany({where:{product:{vendorPublication:{vendorId:s.vendor.id}},service:{vendorId:s.vendor.id}},select:{id:true,active:true,product:{select:{name:true}},service:{select:{name:true}}},take:500}),
  prisma.orderService.count({where:{vendorId:s.vendor.id}}),
  prisma.serviceCatalog.findMany({where:{active:true},orderBy:[{category:"asc"},{name:"asc"}],take:1000})]);
 return {services,products,addons,bookingCount,catalog,serviceTypes:SERVICE_TYPES};
}); }
export async function POST(request:Request) {return api(async()=>{
 sameOrigin(request);const s=await getVendorFromSession();if(!s)throw new ApiError(403,"Approved vendor required.");const body=await request.json();
 return prisma.$transaction(async tx=>{
  if(body.action==="availability"){
   const input=z.object({id:z.string(),active:z.boolean()}).parse(body);
   const result=await tx.serviceOffering.updateMany({where:{id:input.id,vendorId:s.vendor.id,moderationStatus:"APPROVED"},data:{active:input.active}});
   if(!result.count)throw new ApiError(403,"Only your approved listings can change availability.");return {success:true};
  }
  if(body.action==="attach"){
   const data=z.object({productId:z.string(),serviceId:z.string(),active:z.boolean()}).parse(body);
   const service=await tx.serviceOffering.findFirst({where:{id:data.serviceId,vendorId:s.vendor.id,moderationStatus:"APPROVED"},select:{id:true}});
   const product=await tx.product.findFirst({where:{id:data.productId,vendorPublication:{vendorId:s.vendor.id}},select:{id:true}});
   if(!service||!product)throw new ApiError(403,"Product and service must belong to your store.");
   return {addon:await tx.productServiceAddon.upsert({where:{productId_serviceId:{productId:data.productId,serviceId:data.serviceId}},create:data,update:{active:data.active}})};
  }
  const {existing,data}=await listingData(tx,body,s.vendor.id);const pending={...data,moderationStatus:"PENDING_APPROVAL"};
  return {service:existing?await tx.serviceOffering.update({where:{id:existing.id},data:pending}):await tx.serviceOffering.create({data:{...pending,vendorId:s.vendor.id}})};
 },{isolationLevel:"Serializable"});
});}
