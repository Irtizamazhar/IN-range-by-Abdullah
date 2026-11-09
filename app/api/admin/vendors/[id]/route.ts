export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { sendVendorApprovedEmail, sendVendorRejectedEmail } from "@/lib/vendor-mail";
import { generateUniqueStoreSlug } from "@/lib/store-slug";
import { ApiError } from "@/lib/marketplace-api";
import { suspendVendor, unsuspendVendor } from "@/lib/vendor-suspension";
import { approvalReadiness, OVERRIDE_REASON_MIN } from "@/lib/vendor-approval";
import { maskedBank, verifiedBankSnapshot } from "@/lib/vendor-bank-security";
import { accountTitleError } from "@/lib/validation/person-name";
import { normalizeAccountNumber } from "@/lib/validation/bank";
import { createVendorNotification } from "@/lib/vendor-notifications";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    /** The admin confirms they compared the CNIC images with the entered CNIC/name and reviewed the bank details. */
    reviewConfirmed: z.literal(true, { error: "Confirm that you reviewed the documents and bank details." }),
    overrideReason: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("verify_bank") }),
  z.object({ action: z.literal("reject_bank_change"), reason: z.string().trim().min(5).max(1000) }),
  z.object({
    action: z.literal("reject"),
    rejectionReason: z.string().min(1).max(2000),
  }),
  z.object({
    action: z.literal("suspend"),
    reason: z.string().min(1).max(2000).optional(),
    suspensionType: z.enum(["permanent", "temporary"]).optional(),
    suspensionUntil: z.string().optional(),
  }),
  z.object({ action: z.literal("unsuspend") }),
  z.object({
    action: z.literal("set_commission"),
    specialCommissionRate: z.union([
      z.number().min(0).max(100),
      z.null(),
    ]),
  }),
]);

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdminPermission("vendors.manage");
  if ("response" in auth) return auth.response;

  const { id } = ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Please check the details and try again.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: { id: true, email: true, shopName: true, status: true, storeSlug: true, bankName: true, accountTitle: true, accountNumber: true, iban: true,
      bankVerificationStatus: true, verifiedBankName: true, verifiedAccountTitle: true, verifiedAccountNumber: true, verifiedIban: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  // Review and commission need a submitted seller; suspending stays available for any account.
  if (vendor.status === "onboarding" && parsed.data.action !== "suspend") return NextResponse.json({ error: "Seller setup must be completed and submitted before review." }, { status: 409 });
  if (vendor.status === "suspended" && parsed.data.action === "reject") return NextResponse.json({ error: "Unsuspend this vendor before rejecting them." }, { status: 409 });
  const wasAlreadyApproved = vendor.status === "approved";
  const adminActorId = auth.admin.id;

  try {
    if (parsed.data.action === "suspend") {
      const result = await suspendVendor({
        vendorId: id,
        adminId: adminActorId,
        adminEmail: auth.admin.email,
        reason: parsed.data.reason,
        type: parsed.data.suspensionType,
        until: parsed.data.suspensionUntil,
      });
      return NextResponse.json({ ok: true, suspensionType: result.type, suspensionUntil: result.until?.toISOString() ?? null });
    }
    if (parsed.data.action === "unsuspend") {
      const result = await unsuspendVendor({ vendorId: id, adminId: adminActorId, adminEmail: auth.admin.email });
      return NextResponse.json({ ok: true, status: result.status });
    }

    let auditExtra: Record<string, unknown> = {};
    if (parsed.data.action === "approve") {
      // Every rule is enforced here, not only in the admin UI.
      const readiness = await approvalReadiness(id);
      if (!readiness) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      if (!readiness.canApprove) return NextResponse.json({ error: readiness.blockers[0], blockers: readiness.blockers, reviewItems: readiness.reviewItems }, { status: 409 });
      const overrideReason = parsed.data.overrideReason || "";
      if (readiness.reviewItems.length && overrideReason.length < OVERRIDE_REASON_MIN) {
        return NextResponse.json({ error: `Manual review required: give an override reason of at least ${OVERRIDE_REASON_MIN} characters.`, reviewItems: readiness.reviewItems }, { status: 409 });
      }
      const storeSlug = vendor.storeSlug || (await generateUniqueStoreSlug(prisma, vendor.shopName, vendor.id));
      const now = new Date();
      // Only a pending application can move to approved, even under concurrent requests.
      const updated = await prisma.vendor.updateMany({
        where: { id, status: "pending" },
        data: {
          status: "approved",
          rejectionReason: null,
          approvedAt: now,
          approvedBy: adminActorId,
          ...(vendor.storeSlug ? {} : { storeSlug }),
          ...verifiedBankSnapshot({ bankName: vendor.bankName, accountTitle: vendor.accountTitle, accountNumber: vendor.accountNumber, iban: vendor.iban }, adminActorId, now),
        } as Prisma.VendorUpdateManyMutationInput,
      });
      if (!updated.count) return NextResponse.json({ error: "This application is no longer waiting for review." }, { status: 409 });
      auditExtra = { reviewItems: readiness.reviewItems, cnicReviewedManually: true, overrideReason: readiness.reviewItems.length ? sanitizePlainText(overrideReason, 1000) : null, bank: maskedBank(vendor) };
      if (!wasAlreadyApproved) {
        try {
          await sendVendorApprovedEmail(vendor.email, vendor.shopName);
        } catch (mailErr) {
          console.error("vendor approval email", mailErr);
        }
      }
    } else if (parsed.data.action === "verify_bank") {
      if (vendor.status !== "approved") return NextResponse.json({ error: "Bank details are verified as part of approval for sellers who are not yet approved." }, { status: 409 });
      if (vendor.bankVerificationStatus !== "pending_review") return NextResponse.json({ error: "There is no bank change waiting for verification." }, { status: 409 });
      if (!vendor.bankName.trim() || accountTitleError(vendor.accountTitle) || !normalizeAccountNumber(vendor.accountNumber)) {
        return NextResponse.json({ error: "The new bank details are incomplete or invalid. Reject the change instead." }, { status: 409 });
      }
      await prisma.vendor.update({ where: { id }, data: verifiedBankSnapshot({ bankName: vendor.bankName, accountTitle: vendor.accountTitle, accountNumber: vendor.accountNumber, iban: vendor.iban }, adminActorId) });
      auditExtra = { before: maskedBank(vendor.verifiedAccountNumber ? { bankName: vendor.verifiedBankName ?? "", accountTitle: vendor.verifiedAccountTitle ?? "", accountNumber: vendor.verifiedAccountNumber, iban: vendor.verifiedIban } : null), after: maskedBank(vendor) };
      try { await createVendorNotification({ vendorId: id, type: "bank_details_verified", title: "Payout details verified", message: "JORO verified your new bank details. Future withdrawals will be paid to this account." }); }
      catch (error) { console.error("bank verified notification", error instanceof Error ? error.name : "Unknown"); }
    } else if (parsed.data.action === "reject_bank_change") {
      if (vendor.bankVerificationStatus !== "pending_review") return NextResponse.json({ error: "There is no bank change waiting for verification." }, { status: 409 });
      // Restore the last verified details; the rejected change is kept only in the masked audit log.
      await prisma.vendor.update({
        where: { id },
        data: {
          bankVerificationStatus: "verified", bankChangeRequestedAt: null,
          ...(vendor.verifiedAccountNumber ? { bankName: vendor.verifiedBankName ?? "", accountTitle: vendor.verifiedAccountTitle ?? "", accountNumber: vendor.verifiedAccountNumber, iban: vendor.verifiedIban } : {}),
        },
      });
      auditExtra = { rejected: maskedBank(vendor), reason: sanitizePlainText(parsed.data.reason, 1000) };
      try { await createVendorNotification({ vendorId: id, type: "bank_details_rejected", title: "Payout details change not approved", message: `JORO could not verify your new bank details: ${sanitizePlainText(parsed.data.reason, 500)}. Your previously verified account remains in use.` }); }
      catch (error) { console.error("bank rejected notification", error instanceof Error ? error.name : "Unknown"); }
    } else if (parsed.data.action === "reject") {
      await prisma.vendor.update({
        where: { id },
        data: {
          status: "rejected",
          rejectionReason: sanitizePlainText(
            parsed.data.rejectionReason,
            2000
          ),
        },
      });
      if (vendor.status !== "rejected") {
        try { await sendVendorRejectedEmail(vendor.email, parsed.data.rejectionReason); }
        catch (mailError) { console.error("vendor rejection email", mailError instanceof Error ? mailError.name : "Unknown error"); }
      }
    } else {
      await prisma.vendor.update({
        where: { id },
        data: {
          specialCommissionRate:
            parsed.data.specialCommissionRate == null
              ? null
              : new Prisma.Decimal(
                  parsed.data.specialCommissionRate.toFixed(2)
                ),
        },
      });
    }

    await prisma.vendorAuditLog.create({
      data: {
        vendorId: id,
        action: `admin_${parsed.data.action}`,
        details: {
          adminEmail: auth.admin.email,
          adminId: adminActorId,
          payload: JSON.parse(
            JSON.stringify({ ...parsed.data, ...auditExtra })
          ) as Prisma.InputJsonValue,
        },
      },
    });
    await writeAdminAudit(prisma, {
      adminId: auth.admin.id,
      action: `vendor_${parsed.data.action}`,
      entityType: "Vendor",
      entityId: id,
      details: JSON.parse(JSON.stringify({ previousStatus: vendor.status, ...auditExtra })) as Prisma.InputJsonValue,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("admin vendor PATCH", e);
    return NextResponse.json({ error: "The update could not be saved. Nothing was changed." }, { status: 500 });
  }
}
