export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { approvalReadiness } from "@/lib/vendor-approval";
import { payoutBankDetails } from "@/lib/vendor-bank-security";

type Ctx = { params: { id: string } };

/**
 * Admin review data for one seller: approval blockers and review items, bank verification state and
 * the masked audit trail. The CNIC images themselves are opened from the private document route.
 * Responses are never cached.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireAdminPermission("vendors.manage");
  if ("response" in auth) return auth.response;
  const id = ctx.params.id;
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: {
      ownerName: true, cnic: true, status: true, businessType: true, approvedAt: true, approvedBy: true,
      bankName: true, accountTitle: true, accountNumber: true, iban: true,
      bankVerificationStatus: true, bankChangeRequestedAt: true, bankVerifiedAt: true, bankVerifiedBy: true,
      verifiedBankName: true, verifiedAccountTitle: true, verifiedAccountNumber: true, verifiedIban: true,
    },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  const [readiness, audit] = await Promise.all([
    approvalReadiness(id),
    prisma.vendorAuditLog.findMany({
      where: { vendorId: id, action: { in: ["bank_details_changed", "admin_approve", "admin_reject", "admin_verify_bank", "admin_reject_bank_change"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, createdAt: true, details: true },
    }),
  ]);
  const payout = payoutBankDetails(vendor);

  return NextResponse.json({
    entered: { name: vendor.ownerName, cnic: vendor.cnic },
    status: vendor.status,
    approval: { approvedAt: vendor.approvedAt?.toISOString() ?? null, approvedBy: vendor.approvedBy },
    readiness,
    bank: {
      current: { bankName: vendor.bankName, accountTitle: vendor.accountTitle, accountNumber: vendor.accountNumber, iban: vendor.iban },
      payout,
      verificationStatus: vendor.bankVerificationStatus ?? (vendor.status === "approved" ? "verified" : null),
      changeRequestedAt: vendor.bankChangeRequestedAt?.toISOString() ?? null,
      verifiedAt: vendor.bankVerifiedAt?.toISOString() ?? null,
      verifiedBy: vendor.bankVerifiedBy,
    },
    audit: audit.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
