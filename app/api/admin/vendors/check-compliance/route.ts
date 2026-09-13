export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { calculateVendorRiskScore } from "@/app/api/admin/vendors/_lib/risk-score";

export async function POST() {
  const auth = await requireAdminPermission("vendors.manage");
  if ("response" in auth) return auth.response;

  try {
    const approvedVendors = await prisma.vendor.findMany({
      where: { status: "approved" },
      select: { id: true, status: true },
    });

    const flaggedVendors: string[] = [];
    for (const v of approvedVendors) {
      const risk = await calculateVendorRiskScore(v.id);
      if (risk.riskLevel === "RED" && v.status !== "suspended") {
        flaggedVendors.push(v.id);
        await prisma.vendorAuditLog.create({
          data: {
            vendorId: v.id,
            action: "auto_flag",
            details: {
              riskScore: risk.riskScore,
              riskLevel: risk.riskLevel,
              flags: risk.flags,
              createdAt: new Date().toISOString(),
            },
          },
        });
      }
    }

    return NextResponse.json({
      checked: approvedVendors.length,
      flagged: flaggedVendors.length,
      flaggedVendors,
    });
  } catch (e) {
    console.error("check-compliance", e);
    return NextResponse.json(
      { error: "Compliance check failed" },
      { status: 500 }
    );
  }
}
