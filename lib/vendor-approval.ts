import { prisma } from "@/lib/prisma";
import { normalizePakistanMobile } from "@/lib/pakistan-phone";
import { normalizePakistanCnic } from "@/lib/pakistan-cnic";
import { accountTitleError, personNameError } from "@/lib/validation/person-name";
import { isValidPakistanIban, normalizeAccountNumber } from "@/lib/validation/bank";
import { privateFileExists } from "@/lib/private-storage";
import { nameSimilarity, NAME_MATCH_THRESHOLD } from "@/lib/validation/name-match";

/**
 * Server-side approval gate. `blockers` can never be overridden; `reviewItems` need a written admin
 * override reason (recorded in the audit log). The CNIC number and name are checked by the admin
 * against the uploaded CNIC images (there is no automatic OCR).
 */
export type ApprovalReadiness = {
  canApprove: boolean;
  blockers: string[];
  reviewItems: string[];
  titleMatchesName: boolean | null;
};

export const OVERRIDE_REASON_MIN = 15;

export async function approvalReadiness(vendorId: string, db = prisma): Promise<ApprovalReadiness | null> {
  const vendor = await db.vendor.findUnique({
    where: { id: vendorId },
    select: { status: true, ownerName: true, phone: true, shopName: true, address: true, city: true, cnic: true, businessType: true, businessRegNo: true,
      bankName: true, accountTitle: true, accountNumber: true, iban: true,
      documents: { orderBy: [{ uploadedAt: "desc" }, { id: "desc" }], select: { id: true, documentType: true, fileUrl: true } } },
  });
  if (!vendor) return null;
  const blockers: string[] = [];
  const reviewItems: string[] = [];

  if (vendor.status === "suspended") blockers.push("This seller is suspended. Use the suspension page to reinstate them; approval cannot bypass a suspension.");
  else if (vendor.status === "rejected") blockers.push("This application was rejected. The seller must update and resubmit it before it can be approved.");
  else if (vendor.status === "onboarding") blockers.push("Seller setup must be completed and submitted before review.");
  else if (vendor.status !== "pending") blockers.push("Only applications waiting for review can be approved.");

  if (personNameError(vendor.ownerName, "Owner name")) blockers.push("Owner name is missing or invalid.");
  if (!normalizePakistanMobile(vendor.phone || "")) blockers.push("Mobile number is missing or invalid.");
  if (!vendor.shopName.trim() || vendor.address.trim().length < 5 || !vendor.city.trim()) blockers.push("Store name, address or city is missing.");
  const cnic = vendor.cnic ? normalizePakistanCnic(vendor.cnic) : null;
  if (!cnic) blockers.push("CNIC number is missing or fails validation.");
  if (vendor.businessType === "company" && (vendor.businessRegNo || "").trim().length < 2) blockers.push("Business registration number is missing.");
  if (!vendor.bankName.trim() || accountTitleError(vendor.accountTitle) || !normalizeAccountNumber(vendor.accountNumber)) blockers.push("Bank name, account title or account number is missing or invalid.");
  if (vendor.iban && !isValidPakistanIban(vendor.iban)) blockers.push("IBAN fails validation.");

  const required = vendor.businessType === "company" ? ["cnic_front", "cnic_back", "license"] : ["cnic_front", "cnic_back"];
  for (const type of required) {
    const doc = vendor.documents.find(item => item.documentType === type);
    if (!doc) blockers.push(`Required document missing: ${type.replace(/_/g, " ")}.`);
    else if (!await privateFileExists(doc.fileUrl)) blockers.push(`The ${type.replace(/_/g, " ")} file is missing from storage. Ask the seller to upload it again.`);
  }

  let titleMatchesName: boolean | null = null;
  if (vendor.businessType === "individual" && vendor.accountTitle.trim()) {
    titleMatchesName = nameSimilarity(vendor.ownerName, vendor.accountTitle) >= NAME_MATCH_THRESHOLD;
    if (!titleMatchesName) reviewItems.push("Bank account title does not match the CNIC name.");
  }

  return { canApprove: blockers.length === 0, blockers, reviewItems, titleMatchesName };
}
