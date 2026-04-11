export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import {
  getAdminShopStats,
  getVendorShopStats,
} from "@/lib/vendor-shop-order-stats";

/**
 * Dashboard counters: vendor sees their shop; admin sees marketplace totals.
 * GET /api/orders/stats
 */
export async function GET() {
  const admin = await getAdminSession();
  const vendorSess = await getVendorFromSession();

  if (vendorSess?.vendor) {
    const stats = await getVendorShopStats(vendorSess.vendor.id);
    return NextResponse.json({
      scope: "vendor",
      ...stats,
    });
  }

  if (admin?.user?.role === "admin") {
    const stats = await getAdminShopStats();
    return NextResponse.json({
      scope: "admin",
      ...stats,
    });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
