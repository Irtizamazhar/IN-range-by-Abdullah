import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { vendorEmailVerificationRequired } from "@/lib/vendor-email-verification-flag";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/marketplace-api";
import { generateUniqueStoreSlug, isReservedOrInvalidSlug } from "@/lib/store-slug";
import { PRIVATE_SETUP_KEYS, vendorSetupSchema, type VendorSetupDraft } from "@/lib/vendor-onboarding-schema";
import { privateFileExists } from "@/lib/private-storage";
export { vendorSetupSchema, vendorSetupDraftSchema } from "@/lib/vendor-onboarding-schema";

/**
 * Maps setup input to vendor columns. In "draft" mode the CNIC is kept only in private progress
 * (onboardingData.draftCnic): the unique `cnic` column is written on final submission, after the
 * uniqueness and document checks, so an unfinished draft can never reserve someone else's CNIC.
 */
export function vendorSetupData(input: VendorSetupDraft, current: Prisma.JsonValue | null = null, mode: "draft" | "submit" = "draft") {
  const details: Record<string, unknown> = current && typeof current === "object" && !Array.isArray(current) ? {...current} : {};
  if (mode === "draft" && input.cnic !== undefined) details.draftCnic = input.cnic;
  if (mode === "submit") delete details.draftCnic;
  for (const key of PRIVATE_SETUP_KEYS) if (input[key] !== undefined) details[key] = input[key];
  if (input.documentNames) {
    const saved = details.documentNames && typeof details.documentNames === "object" ? details.documentNames : {};
    details.documentNames = {...saved, ...input.documentNames};
  }
  const data: Prisma.VendorUpdateManyMutationInput = {onboardingData: details as Prisma.InputJsonObject};
  const columns = ["phone","shopName","shopDescription","businessType","businessRegNo","address","city","bankName","accountTitle","accountNumber","iban", ...(mode === "submit" ? ["cnic"] as const : [])] as const;
  for (const key of columns)
    if (input[key] !== undefined) Object.assign(data, {[key]:input[key] || (["cnic","iban","businessRegNo"].includes(key) ? null : "")});
  if (input.name !== undefined) data.ownerName = input.name;
  if (input.category !== undefined) data.primaryCategory = input.category;
  if (input.storeSlug) data.storeSlug = input.storeSlug;
  return data;
}

export async function validateSetupSlug(tx: Prisma.TransactionClient, vendorId: string, slug?: string) {
  if (!slug) return;
  if (isReservedOrInvalidSlug(slug)) throw new ApiError(400,"Choose a valid, non-reserved store URL.", {storeSlug:"Choose a valid, non-reserved store URL."});
  const [vendor,alias] = await Promise.all([
    tx.vendor.findFirst({where:{OR:[{id:slug},{storeSlug:slug}],NOT:{id:vendorId}},select:{id:true}}),
    tx.storeSlugAlias.findUnique({where:{slug},select:{vendorId:true}}),
  ]);
  if (vendor || alias && alias.vendorId !== vendorId) throw new ApiError(409,"That store URL is already in use.", {storeSlug:"That store URL is already in use."});
}

/** Required details a blank draft value must not erase; optional ones (postal code, IBAN, NTN…) may still be cleared. */
const KEEP_WHEN_BLANK = ["name","phone","shopName","category","address","city","province","cnic","pickupAddress","pickupCity","pickupProvince","pickupContactName","pickupPhone","bankName","accountTitle","accountNumber"] as const;

/** A store keeps its slug once assigned; otherwise one is generated from the store name. */
async function assignStoreSlug(tx: Prisma.TransactionClient, vendorId: string, current: {storeSlug?: string|null; shopName?: string|null}, input: {storeSlug?: string; shopName?: string}) {
  if (current.storeSlug) return current.storeSlug;
  if (input.storeSlug) { await validateSetupSlug(tx,vendorId,input.storeSlug); return input.storeSlug; }
  const name=(input.shopName||current.shopName||"").trim();
  return name ? generateUniqueStoreSlug(tx,name,vendorId) : undefined;
}

export async function saveVendorSetup(vendorId: string, input: VendorSetupDraft, db = prisma) {
  return db.$transaction(async tx => {
    const current=await tx.vendor.findUnique({where:{id:vendorId},select:{status:true,onboardingData:true,storeSlug:true,shopName:true}});
    if (!current || !["onboarding","rejected"].includes(current.status)) throw new ApiError(409,"This application is no longer editable.");
    const draft={...input};
    for (const key of KEEP_WHEN_BLANK) if (draft[key]==="") delete draft[key];
    const storeSlug=await assignStoreSlug(tx,vendorId,current,draft);
    await tx.vendor.update({where:{id:vendorId},data:{...vendorSetupData({...draft,storeSlug},current.onboardingData),...(current.status==="rejected"?{status:"onboarding" as const}:{})}});
  },{isolationLevel:"Serializable"});
}

/** Vendor CNIC typed in setup, preferring the private draft value over the stored column. */
export function currentSetupCnic(vendor: { cnic: string | null; onboardingData: Prisma.JsonValue | null }): string {
  const data = vendor.onboardingData && typeof vendor.onboardingData === "object" && !Array.isArray(vendor.onboardingData) ? vendor.onboardingData as Record<string, unknown> : {};
  return typeof data.draftCnic === "string" ? data.draftCnic : vendor.cnic || "";
}

export async function submitVendorSetup(vendorId: string, raw: unknown) {
  const input = vendorSetupSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const vendor = await tx.vendor.findUnique({ where: { id: vendorId }, select: { status: true, onboardingData: true, storeSlug: true, shopName: true } });
    if (!vendor || !["onboarding", "rejected"].includes(vendor.status)) throw new ApiError(409, "This application is no longer editable.");
    const taken = await tx.vendor.findFirst({ where: { cnic: input.cnic, NOT: { id: vendorId } }, select: { id: true } });
    if (taken) throw new ApiError(409, "This CNIC is already registered to another seller account. Contact JORO support if this is your CNIC.", { cnic: "This CNIC is already registered to another seller account." });
    const storeSlug = await assignStoreSlug(tx, vendorId, vendor, input);
    const docs = await tx.vendorDocument.findMany({ where: { vendorId }, orderBy: [{ uploadedAt: "desc" }, { id: "desc" }], select: { id: true, documentType: true, fileUrl: true } });
    const required = input.businessType === "company" ? ["cnic_front", "cnic_back", "license"] : ["cnic_front", "cnic_back"];
    const latest = required.map(type => docs.find(doc => doc.documentType === type));
    if (latest.some(doc => !doc)) throw new ApiError(400, "Upload all required verification documents before submitting.");
    for (const doc of latest) {
      if (!await privateFileExists(doc!.fileUrl)) throw new ApiError(400, "One of your verification documents could not be found. Upload it again before submitting.", { documents: "Upload your verification documents again." });
    }
    // Merge into saved progress so legacy private details are kept.
    const data = vendorSetupData({ ...input, storeSlug }, vendor.onboardingData, "submit");
    data.onboardingData = { ...(data.onboardingData as Prisma.InputJsonObject), step: 4, declarationAcceptedAt: new Date().toISOString() };
    await tx.vendor.update({ where: { id: vendorId }, data: { ...data, status: "pending", rejectionReason: null, onboardingSubmittedAt: new Date(),
      isEmailVerified: !vendorEmailVerificationRequired(), emailVerifyToken: vendorEmailVerificationRequired() ? randomBytes(32).toString("hex") : null } });
    return { ok: true, status: "pending", next: "/vendor/status" };
  }, { isolationLevel: "Serializable" }).catch(error => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "This CNIC is already registered to another seller account.", { cnic: "This CNIC is already registered to another seller account." });
    }
    throw error;
  });
}
