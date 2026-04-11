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
