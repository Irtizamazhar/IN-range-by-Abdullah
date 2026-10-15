import { sendVendorVerificationEmail } from "@/lib/vendor-mail";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { vendorSetupSchema, vendorSetupDraftSchema, saveVendorSetup, submitVendorSetup } from "@/lib/vendor-onboarding";
import { saveVendorDocumentBuffer } from "@/lib/vendor-doc-upload";
import { imageExtension } from "@/lib/security/image-signature";
import { setupStepErrors } from "@/lib/vendor-onboarding-schema";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function actor() {
  const session = await getVendorFromSession({ allowUnapproved: true });
  if (!session) throw new ApiError(401, "Seller sign-in required.");
  return session.vendor;
}

async function setupRequest(request: Request) {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    const fields = await request.json();
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) throw new ApiError(400, "Please supply your seller setup details.");
    return { fields, files: [] };
  }
  const form = await request.formData();
  const fields = Object.fromEntries(Array.from(form.entries()).filter(([, value]) => typeof value === "string"));
  const files = (["cnic_front", "cnic_back", "license"] as const).flatMap(type => {
    const file = form.get(type);
    // Node 18 supports Request.formData() but has no global File constructor.
    // FormData entries are already typed/validated by the platform parser.
    return file && typeof file !== "string" && file.size > 0 ? [{ type, file }] : [];
  });
  for (const { file } of files) {
    if (file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      throw new ApiError(400, "Documents must be JPG, PNG or WebP under 5MB.");
    }
    if (!imageExtension(Buffer.from(await file.arrayBuffer()), file.type)) throw new ApiError(400, "Document contents must match the image type.");
  }
  return { fields, files };
}

export async function GET() {
  return api(async () => {
    const vendor = await actor();
    return { vendor: await prisma.vendor.findUnique({
      where: { id: vendor.id },
      select: { ownerName: true, email: true, phone: true, city: true, address: true, shopName: true,
        businessType: true, businessRegNo: true, cnic: true, primaryCategory: true, bankName: true,
        accountTitle: true, accountNumber: true, iban: true, storeSlug: true, shopDescription: true, onboardingData: true, rejectionReason: true, status: true, isEmailVerified: true,
        documents: { select: { id: true, documentType: true } } },
    }) };
  });
}

export async function PATCH(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const vendor = await actor();
    if (!["onboarding","rejected"].includes(vendor.status)) throw new ApiError(409, "This application is no longer editable.");
    const { fields, files } = await setupRequest(request);
    if (fields.intent === "continue") {
      const active = Number(fields.currentStep);
      if (!Number.isInteger(active) || active < 0 || active > 3 || Number(fields.step) !== active + 1) throw new ApiError(400, "Invalid setup step.");
      const fieldErrors = setupStepErrors(fields, active);
      if (active === 1) {
        const existing = await prisma.vendorDocument.findMany({ where: { vendorId: vendor.id }, select: { documentType: true } });
        const required = fields.businessType === "company" ? ["cnic_front", "cnic_back", "license"] : ["cnic_front", "cnic_back"];
        if (required.some(type => !existing.some(doc => doc.documentType === type) && !files.some(upload => upload.type === type))) fieldErrors.documents = "Upload all required verification documents before continuing.";
      }
      if (Object.keys(fieldErrors).length) return NextResponse.json({ error: "Please check the highlighted details.", fieldErrors }, { status: 400 });
    }
    const parsed = vendorSetupDraftSchema.safeParse(fields);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: issue.message, fieldErrors: Object.fromEntries(parsed.error.issues.map(i => [i.path.join("."), i.message])) }, { status: 400 });
    }
    for (const { type, file } of files) {
      await saveVendorDocumentBuffer(vendor.id, type, Buffer.from(await file.arrayBuffer()), file.type);
    }
    await saveVendorSetup(vendor.id, parsed.data);
    return { ok: true, uploaded: files.map(file => file.type), documents: await prisma.vendorDocument.findMany({ where: { vendorId: vendor.id }, select: { id: true, documentType: true } }) };
  });
}

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const vendor = await actor();
    if (!["onboarding","rejected"].includes(vendor.status)) throw new ApiError(409, "This application is no longer editable.");
    const { fields, files } = await setupRequest(request);
    const parsed = vendorSetupSchema.safeParse(fields);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: issue.message, fieldErrors: Object.fromEntries(parsed.error.issues.map(i => [i.path.join("."), i.message])) }, { status: 400 });
    }
    if (parsed.data.businessType === "company" && !parsed.data.businessRegNo?.trim()) {
      throw new ApiError(400, "Business registration number is required.");
    }
    for (const { type, file } of files) {
      await saveVendorDocumentBuffer(vendor.id, type, Buffer.from(await file.arrayBuffer()), file.type);
    }
    const result = await submitVendorSetup(vendor.id, parsed.data);
    const submitted = await prisma.vendor.findUnique({
      where: { id: vendor.id }, select: { email: true, emailVerifyToken: true },
    });
    if (submitted?.emailVerifyToken) {
      try { await sendVendorVerificationEmail(submitted.email, submitted.emailVerifyToken); } catch { return {...result, emailDelivery:"failed", message:"Application submitted. Verification email could not be sent; request another link from the status page."}; }
    }
    return result;
  });
}
