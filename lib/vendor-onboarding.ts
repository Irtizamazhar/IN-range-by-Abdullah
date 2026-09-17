import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { vendorEmailVerificationRequired } from "@/lib/vendor-email-verification-flag";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/marketplace-api";
import { isReservedOrInvalidSlug } from "@/lib/store-slug";
import { PRIVATE_SETUP_KEYS, vendorSetupSchema, type VendorSetupDraft } from "@/lib/vendor-onboarding-schema";
export { vendorSetupSchema, vendorSetupDraftSchema } from "@/lib/vendor-onboarding-schema";

export function vendorSetupData(input: VendorSetupDraft, current: Prisma.JsonValue | null = null) {
  const details: Record<string, unknown> = current && typeof current === "object" && !Array.isArray(current) ? {...current} : {};
  for (const key of PRIVATE_SETUP_KEYS) if (input[key] !== undefined) details[key] = input[key];
  const data: Prisma.VendorUpdateManyMutationInput = {onboardingData: details as Prisma.InputJsonObject};
  for (const key of ["phone","shopName","shopDescription","businessType","businessRegNo","address","city","cnic","bankName","accountTitle","accountNumber","iban"] as const)
    if (input[key] !== undefined) Object.assign(data, {[key]:input[key] || (["cnic","iban","businessRegNo"].includes(key) ? null : "")});
  if (input.name !== undefined) data.ownerName = input.name;
  if (input.category !== undefined) data.primaryCategory = input.category;
  if (input.storeSlug) data.storeSlug = input.storeSlug;
  return data;
}

export async function validateSetupSlug(tx: Prisma.TransactionClient, vendorId: string, slug?: string) {
  if (!slug) return;
  if (isReservedOrInvalidSlug(slug)) throw new ApiError(400,"Choose a valid, non-reserved store URL.");
  const [vendor,alias] = await Promise.all([
    tx.vendor.findFirst({where:{OR:[{id:slug},{storeSlug:slug}],NOT:{id:vendorId}},select:{id:true}}),
    tx.storeSlugAlias.findUnique({where:{slug},select:{vendorId:true}}),
  ]);
  if (vendor || alias && alias.vendorId !== vendorId) throw new ApiError(409,"That store URL is already in use.");
}

export async function saveVendorSetup(vendorId: string, input: VendorSetupDraft) {
  return prisma.$transaction(async tx => {
    const current=await tx.vendor.findUnique({where:{id:vendorId},select:{status:true,onboardingData:true}});
    if (!current || !["onboarding","rejected"].includes(current.status)) throw new ApiError(409,"This application is no longer editable.");
    await validateSetupSlug(tx,vendorId,input.storeSlug);
    await tx.vendor.update({where:{id:vendorId},data:{...vendorSetupData(input,current.onboardingData),...(current.status==="rejected"?{status:"onboarding" as const}:{})}});
  },{isolationLevel:"Serializable"});
}

export async function submitVendorSetup(vendorId: string, raw: unknown) {
  const input=vendorSetupSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const vendor=await tx.vendor.findUnique({where:{id:vendorId},select:{status:true}});
    if (!vendor || !["onboarding","rejected"].includes(vendor.status)) throw new ApiError(409,"This application is no longer editable.");
    await validateSetupSlug(tx,vendorId,input.storeSlug);
    const docs=await tx.vendorDocument.findMany({where:{vendorId},select:{documentType:true}});
    const required=input.businessType==="company"?["cnic_front","cnic_back","license"]:["cnic_front","cnic_back"];
    if (required.some(type=>!docs.some(doc=>doc.documentType===type))) throw new ApiError(400,"Upload all required verification documents before submitting.");
    const data=vendorSetupData(input);
    data.onboardingData={...(data.onboardingData as Prisma.InputJsonObject),step:4,declarationAcceptedAt:new Date().toISOString()};
    await tx.vendor.update({where:{id:vendorId},data:{...data,status:"pending",rejectionReason:null,onboardingSubmittedAt:new Date(),
      isEmailVerified:!vendorEmailVerificationRequired(),emailVerifyToken:vendorEmailVerificationRequired()?randomBytes(32).toString("hex"):null}});
    return {ok:true,status:"pending",next:"/vendor/status"};
  },{isolationLevel:"Serializable"});
}
