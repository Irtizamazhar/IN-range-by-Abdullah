import { sendVendorVerificationEmail } from "@/lib/vendor-mail";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { vendorSetupSchema, vendorSetupDraftSchema, saveVendorSetup, submitVendorSetup } from "@/lib/vendor-onboarding";
import { saveVendorDocumentBuffer } from "@/lib/vendor-doc-upload";
import { imageExtension } from "@/lib/security/image-signature";

export const dynamic = "force-dynamic";

async function actor() {
  const session = await getVendorFromSession({ allowUnapproved: true });
  if (!session) throw new ApiError(401, "Seller sign-in required.");
  return session.vendor;
}

async function setupRequest(request: Request) {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return { fields: await request.json(), files: [] };
  }
  const form = await request.formData();
  const fields = Object.fromEntries(Array.from(form.entries()).filter(([, value]) => typeof value === "string"));
  const files = (["cnic_front", "cnic_back", "license"] as const).flatMap(type => {
    const file = form.get(type);
    return file instanceof File && file.size ? [{ type, file }] : [];
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
    const parsed = vendorSetupDraftSchema.safeParse(fields);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ApiError(400, issue.path.join(".") + ": " + issue.message);
    }
    await saveVendorSetup(vendor.id, parsed.data);
    for (const { type, file } of files) {
      await saveVendorDocumentBuffer(vendor.id, type, Buffer.from(await file.arrayBuffer()), file.type);
    }
    return { ok: true, uploaded: files.map(file => file.type) };
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
      throw new ApiError(400, issue.path.join(".") + ": " + issue.message);
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
