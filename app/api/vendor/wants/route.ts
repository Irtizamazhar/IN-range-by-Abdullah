export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;
  const rows = await prisma.wantPost.findMany({
    where: { status: "open", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      offers: {
        where: { vendorId: auth.vendor.id },
        select: { id: true, amount: true, message: true, estimatedDays: true, status: true },
      },
      _count: { select: { offers: true } },
    },
  });
  return NextResponse.json({
    wants: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      city: row.city,
      budgetMin: row.budgetMin == null ? null : Number(row.budgetMin),
      budgetMax: row.budgetMax == null ? null : Number(row.budgetMax),
      quantity: row.quantity,
      condition: row.condition,
      createdAt: row.createdAt,
      offerCount: row._count.offers,
      myOffer: row.offers[0]
        ? { ...row.offers[0], amount: Number(row.offers[0].amount) }
        : null,
    })),
  });
}
