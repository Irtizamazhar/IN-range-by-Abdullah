export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { VendorAccountStatus } from "@prisma/client";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

const STATUSES: VendorAccountStatus[] = [
  "pending",
  "approved",
  "rejected",
  "suspended",
];

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("status")?.toLowerCase();
  const status =
    raw && STATUSES.includes(raw as VendorAccountStatus)
      ? (raw as VendorAccountStatus)
      : undefined;

  try {
    const vendors = await prisma.vendor.findMany({
      where: status ? { status } : undefined,
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
        primaryCategory: true,
        shopDescription: true,
        specialCommissionRate: true,
        status: true,
        isEmailVerified: true,
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
