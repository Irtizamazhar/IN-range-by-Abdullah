export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";
import { ApiError, sameOrigin } from "@/lib/marketplace-api";
import { consumeOrReject, createLoginRateLimiter } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/vendor-ip";
import { bankChangeUpdate, bankUpdateSchema, maskedBank, payoutBankDetails, sameBankDetails } from "@/lib/vendor-bank-security";
import { maskAccount } from "@/lib/validation/bank";
import { createVendorNotification } from "@/lib/vendor-notifications";
import { sendVendorBankChangedEmail } from "@/lib/vendor-mail";

/** Password re-entry attempts for payout changes: same budget as sign-in. */
const changeLimiter = createLoginRateLimiter();

const bankSelect = {
  status: true, email: true, passwordHash: true,
  bankName: true, accountTitle: true, accountNumber: true, iban: true,
  bankVerificationStatus: true, bankChangeRequestedAt: true, bankVerifiedAt: true,
  verifiedBankName: true, verifiedAccountTitle: true, verifiedAccountNumber: true, verifiedIban: true,
} as const;

export async function GET() {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const v = await prisma.vendor.findUnique({ where: { id: auth.vendor.id }, select: bankSelect });
  if (!v) return NextResponse.json({});
  const payout = payoutBankDetails(v);
  return NextResponse.json({
    bankName: v.bankName,
    accountTitle: v.accountTitle,
    accountNumber: v.accountNumber,
    iban: v.iban,
    verification: {
      status: v.bankVerificationStatus ?? "verified",
      pendingSince: v.bankChangeRequestedAt?.toISOString() ?? null,
      // Withdrawals go to this account (masked).
      payoutAccount: payout ? { bankName: payout.bankName, accountTitle: payout.accountTitle, accountNumber: maskAccount(payout.accountNumber) } : null,
    },
  });
}

export async function PATCH(req: NextRequest) {
  try { sameOrigin(req); }
  catch (error) { return NextResponse.json({ error: error instanceof ApiError ? error.message : "Request rejected." }, { status: 403 }); }
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const limited = await consumeOrReject(changeLimiter, `vendor-bank:${auth.vendor.id}`);
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts. Try again later.", retrySecs: limited.retrySecs }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bankUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message || "Check your bank details.", field: issue?.path[0] ?? null }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUnique({ where: { id: auth.vendor.id }, select: bankSelect });
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Re-authenticate: a hijacked session alone must not be able to redirect payouts.
  const password = parsed.data.currentPassword;
  const passwordOk = await bcrypt.compare(password, vendor.passwordHash) || (password.trim() !== password && await bcrypt.compare(password.trim(), vendor.passwordHash));
  if (!passwordOk) return NextResponse.json({ error: "Current password is incorrect.", field: "currentPassword" }, { status: 403 });

  const next = { bankName: parsed.data.bankName, accountTitle: parsed.data.accountTitle, accountNumber: parsed.data.accountNumber, iban: parsed.data.iban };
  if (sameBankDetails(vendor, next)) {
    return NextResponse.json({ ok: true, unchanged: true, status: vendor.bankVerificationStatus ?? "verified" });
  }

  const data = bankChangeUpdate(vendor, next);
  const pendingReview = data.bankVerificationStatus === "pending_review";
  await prisma.$transaction([
    prisma.vendor.update({ where: { id: auth.vendor.id }, data }),
    prisma.vendorAuditLog.create({
      data: {
        vendorId: auth.vendor.id,
        action: "bank_details_changed",
        ipAddress: clientIp(req),
        userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
        details: { before: maskedBank(vendor), after: maskedBank(next), pendingReview },
      },
    }),
  ]);

  const masked = maskAccount(next.accountNumber);
  try {
    await createVendorNotification({
      vendorId: auth.vendor.id,
      type: "bank_details_changed",
      title: "Payout details changed",
      message: pendingReview
        ? `Your bank details were changed to ${next.bankName} ${masked}. Withdrawals use your previously verified account until JORO verifies the new details.`
        : `Your bank details were changed to ${next.bankName} ${masked}.`,
    });
  } catch (error) {
    console.error("bank change notification", error instanceof Error ? error.name : "Unknown");
  }
  try {
    await sendVendorBankChangedEmail(vendor.email, { maskedAccount: masked, bankName: next.bankName, pendingReview });
  } catch (error) {
    console.error("bank change email", error instanceof Error ? error.name : "Unknown");
  }

  return NextResponse.json({ ok: true, status: pendingReview ? "pending_review" : "verified" });
}
