export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await prisma.vendorAuditLog.findMany({
      where: { action: "vendor_appeal", vendor: { status: "suspended" } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        createdAt: true,
        details: true,
        vendor: {
          select: {
            id: true,
            shopName: true,
            ownerName: true,
            email: true,
            status: true,
          },
        },
      },
    });

    const notifications = rows.map((r) => {
      const details =
        r.details && typeof r.details === "object"
          ? (r.details as Record<string, unknown>)
          : {};
      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        message: typeof details.message === "string" ? details.message : "",
        reasonType: typeof details.reasonType === "string" ? details.reasonType : "general",
        paymentProofUrl:
          typeof details.paymentProofUrl === "string" ? details.paymentProofUrl : null,
        resolved: details.resolved === true,
        vendor: r.vendor,
      };
    });

    // Keep one latest unresolved notification per vendor to avoid duplicate cards/counts.
    const byVendor = new Map<string, (typeof notifications)[number]>();
    for (const n of notifications) {
      if (n.resolved) continue;
      if (!n.vendor) continue;
      if (!byVendor.has(n.vendor.id)) {
        byVendor.set(n.vendor.id, n);
      }
    }
    const deduped = Array.from(byVendor.values());

    return NextResponse.json({
      notifications: deduped,
      unresolvedCount: deduped.length,
    });
  } catch (e) {
    console.error("GET /api/admin/notifications", e);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}
