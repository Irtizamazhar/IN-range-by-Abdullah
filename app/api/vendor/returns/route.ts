export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { RETURN_INCLUDE, serializeReturn } from "@/lib/after-sales";
import { prisma } from "@/lib/prisma";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";

export async function GET() {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;
  const rows = await prisma.returnRequest.findMany({
    where: { vendorId: auth.vendor.id },
    orderBy: { requestedAt: "desc" },
    include: RETURN_INCLUDE,
  });
  return NextResponse.json({ returns: rows.map(serializeReturn) });
}
