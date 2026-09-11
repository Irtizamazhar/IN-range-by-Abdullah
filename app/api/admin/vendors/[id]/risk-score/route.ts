export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";
import { calculateVendorRiskScore } from "@/app/api/admin/vendors/_lib/risk-score";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendorId = String(ctx.params.id || "");
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendor id" }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  try {
    const risk = await calculateVendorRiskScore(vendorId);
    return NextResponse.json(risk);
  } catch (e) {
    console.error("vendor risk score", e);
    return NextResponse.json(
      { error: "Failed to calculate risk score" },
      { status: 500 }
    );
  }
}
