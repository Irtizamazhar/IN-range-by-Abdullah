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
    const [pendingVendors, pendingSellerOrders] = await Promise.all([
      prisma.vendor.count({ where: { status: "pending" } }),
      prisma.vendorShopOrder.count({ where: { status: "pending" } }),
    ]);

    return NextResponse.json({
      pendingVendors,
      pendingSellerOrders,
    });
  } catch (e) {
    console.error("GET /api/admin/sidebar-badges", e);
    return NextResponse.json(
      { error: "Failed to load counts", pendingVendors: 0, pendingSellerOrders: 0 },
      { status: 500 }
    );
  }
}
