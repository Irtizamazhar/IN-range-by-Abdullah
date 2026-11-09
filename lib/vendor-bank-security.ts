import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { accountNumberSchema, accountTitleSchema, bankNameSchema, optionalIbanSchema } from "@/lib/validation/schemas";
import { maskAccount } from "@/lib/validation/bank";

/**
 * Payout-detail security.
 *
 * - The vendor's editable bank fields (bankName/accountTitle/accountNumber/iban) are what they last
 *   entered. Withdrawals never use them directly after approval.
 * - `verified*` columns hold the details an admin verified (copied at approval or on "verify bank").
 * - A change by an approved vendor sets bankVerificationStatus = pending_review and alerts admins.
 *   Withdrawals keep using the last verified details until an admin verifies the new ones.
 * - Vendors approved before this existed have bankVerificationStatus = null: their current details
 *   were accepted at approval, so they are treated as verified until the first change, at which point
 *   the pre-change details are snapshotted as the verified set.
 */
export const bankUpdateSchema = z.object({
  bankName: bankNameSchema,
  accountTitle: accountTitleSchema,
  accountNumber: accountNumberSchema,
  iban: z.union([optionalIbanSchema, z.null()]).optional().transform(value => value || null),
  currentPassword: z.string().min(1, "Enter your current password to change payout details.").max(128),
});

export type BankDetails = { bankName: string; accountTitle: string; accountNumber: string; iban: string | null };

type VendorBankRow = BankDetails & {
  status: string;
  bankVerificationStatus: "verified" | "pending_review" | null;
  verifiedBankName: string | null;
  verifiedAccountTitle: string | null;
  verifiedAccountNumber: string | null;
  verifiedIban: string | null;
};

export function sameBankDetails(a: BankDetails, b: BankDetails): boolean {
  const norm = (value: string | null) => (value || "").replace(/[\s-]/g, "").toUpperCase();
  return norm(a.bankName) === norm(b.bankName) && norm(a.accountTitle) === norm(b.accountTitle)
    && norm(a.accountNumber) === norm(b.accountNumber) && norm(a.iban) === norm(b.iban);
}

/** The bank details a withdrawal may be paid to, or null when none are verified yet. */
export function payoutBankDetails(vendor: VendorBankRow): BankDetails | null {
  if (vendor.verifiedAccountNumber && vendor.verifiedBankName && vendor.verifiedAccountTitle) {
    return { bankName: vendor.verifiedBankName, accountTitle: vendor.verifiedAccountTitle, accountNumber: vendor.verifiedAccountNumber, iban: vendor.verifiedIban };
  }
  // Legacy approved sellers whose details pre-date verification and were never changed since.
  if (vendor.status === "approved" && vendor.bankVerificationStatus === null && vendor.accountNumber && vendor.bankName && vendor.accountTitle) {
    return { bankName: vendor.bankName, accountTitle: vendor.accountTitle, accountNumber: vendor.accountNumber, iban: vendor.iban };
  }
  return null;
}

/**
 * Builds the vendor update for a bank-detail change. For an approved seller the change goes to
 * pending review; the verified snapshot is preserved (or created from the pre-change legacy details).
 */
export function bankChangeUpdate(vendor: VendorBankRow, next: BankDetails, now = new Date()): Prisma.VendorUpdateInput {
  const data: Prisma.VendorUpdateInput = { ...next };
  if (vendor.status !== "approved") return data;
  if (vendor.bankVerificationStatus === null && !vendor.verifiedAccountNumber && vendor.accountNumber) {
    Object.assign(data, { verifiedBankName: vendor.bankName, verifiedAccountTitle: vendor.accountTitle, verifiedAccountNumber: vendor.accountNumber, verifiedIban: vendor.iban });
  }
  const verified = payoutBankDetails(vendor);
  if (verified && sameBankDetails(verified, next)) {
    Object.assign(data, { bankVerificationStatus: "verified", bankChangeRequestedAt: null });
  } else {
    Object.assign(data, { bankVerificationStatus: "pending_review", bankChangeRequestedAt: now });
  }
  return data;
}

/** Copies the vendor's current details into the verified snapshot (admin approval / verify bank). */
export function verifiedBankSnapshot(details: BankDetails, adminId: string, now = new Date()): Prisma.VendorUpdateInput {
  return {
    verifiedBankName: details.bankName, verifiedAccountTitle: details.accountTitle, verifiedAccountNumber: details.accountNumber, verifiedIban: details.iban,
    bankVerificationStatus: "verified", bankVerifiedAt: now, bankVerifiedBy: adminId, bankChangeRequestedAt: null,
  };
}

/** Audit-safe summary: bank name and title in full, account/IBAN masked to the last 4 characters. */
export function maskedBank(details: Partial<BankDetails> | null) {
  if (!details) return null;
  return { bankName: details.bankName ?? null, accountTitle: details.accountTitle ?? null, accountNumber: maskAccount(details.accountNumber), iban: details.iban ? maskAccount(details.iban) : null };
}
