export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { DISPUTE_INCLUDE, serializeDispute } from "@/lib/after-sales";
import { prisma } from "@/lib/prisma";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";

export async function GET() {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;
  const rows = await prisma.dispute.findMany({
    where: { vendorId: auth.vendor.id },
    orderBy: { createdAt: "desc" },
    include: DISPUTE_INCLUDE,
  });
  return NextResponse.json({ disputes: rows.map(serializeDispute) });
}
