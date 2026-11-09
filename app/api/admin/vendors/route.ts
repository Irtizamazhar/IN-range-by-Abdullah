export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { Prisma, VendorAccountStatus } from "@prisma/client";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { sweepExpiredSuspensions } from "@/lib/vendor-suspension";

// Unfinished seller setups stay out of the admin list until they are submitted for review.
const STATUSES: VendorAccountStatus[] = [
  "pending",
  "approved",
  "rejected",
  "suspended",
];

export async function GET(req: NextRequest) {
  const auth = await requireAdminPermission("vendors.manage");
  if ("response" in auth) return auth.response;

  const raw = req.nextUrl.searchParams.get("status")?.toLowerCase();
  const status =
    raw && STATUSES.includes(raw as VendorAccountStatus)
      ? (raw as VendorAccountStatus)
      : undefined;
  const where: Prisma.VendorWhereInput = status ? { status } : { status: { not: "onboarding" } };

  try {
    await sweepExpiredSuspensions();
    const page = Math.max(1, Math.min(100000, Number(req.nextUrl.searchParams.get("page")) || 1));
    const pageSize = 20;
    const total = await prisma.vendor.count({ where });
    const vendors = await prisma.vendor.findMany({
      take: pageSize,
      skip: (Math.floor(page) - 1) * pageSize,
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        shopName: true,
        ownerName: true,
        email: true,
        phone: true,
        city: true,
        cnic: true,
        address: true,
        businessType: true,
        businessRegNo: true,
        bankName: true,
        accountTitle: true,
        accountNumber: true,
        iban: true,
        storeSlug: true,
        onboardingData: true,
        onboardingSubmittedAt: true,
        primaryCategory: true,
        shopDescription: true,
        specialCommissionRate: true,
        status: true,
        isEmailVerified: true,
        bankVerificationStatus: true,
        rejectionReason: true,
        createdAt: true,
        auditLogs: {
          where: { action: "vendor_appeal" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            createdAt: true,
            details: true,
          },
        },
        documents: {
          select: {
            id: true,
            documentType: true,
            fileUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      total, page: Math.floor(page), pageSize,
      vendors: vendors.map((v) => ({
        ...v,
        latestAppeal:
          v.auditLogs[0] != null
            ? {
                id: v.auditLogs[0].id,
                createdAt: v.auditLogs[0].createdAt.toISOString(),
                message:
                  v.auditLogs[0].details &&
                  typeof v.auditLogs[0].details === "object" &&
                  "message" in
                    (v.auditLogs[0].details as Record<string, unknown>) &&
                  typeof (v.auditLogs[0].details as Record<string, unknown>)
                    .message === "string"
                    ? ((v.auditLogs[0].details as Record<string, string>).message ??
                      null)
                    : null,
              }
            : null,
        auditLogs: undefined,
        documents: v.documents.map((document) => ({
          ...document,
          fileUrl: `/api/private/vendor-documents/${document.id}`,
        })),
        specialCommissionRate:
          v.specialCommissionRate != null
            ? Number(v.specialCommissionRate)
            : null,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("admin vendors GET", e);
    return NextResponse.json({ error: "Failed to load vendors" }, { status: 500 });
  }
}
