export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

/** Counts for admin sidebar badges (pending vendor signups + new seller shop orders). */
export async function GET() {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [pendingVendors, pendingSellerOrders, pendingAppealsRaw] = await Promise.all([
      prisma.vendor.count({ where: { status: "pending" } }),
      prisma.vendorShopOrder.count({ where: { status: "pending" } }),
      prisma.vendorAuditLog.findMany({
        where: { action: "vendor_appeal", vendor: { status: "suspended" } },
        select: { details: true, vendorId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);
    const pendingAppealsSet = new Set<string>();
    for (const row of pendingAppealsRaw) {
      const d =
        row.details && typeof row.details === "object"
          ? (row.details as Record<string, unknown>)
          : {};
      if (d.resolved === true) continue;
      if (!row.vendorId) continue;
      pendingAppealsSet.add(row.vendorId);
    }
    const pendingAppeals = pendingAppealsSet.size;

    return NextResponse.json({
      pendingVendors,
      pendingSellerOrders,
      pendingAppeals,
    });
  } catch (e) {
    console.error("GET /api/admin/sidebar-badges", e);
    return NextResponse.json(
      {
        error: "Failed to load counts",
        pendingVendors: 0,
        pendingSellerOrders: 0,
        pendingAppeals: 0,
      },
      { status: 500 }
    );
  }
}
