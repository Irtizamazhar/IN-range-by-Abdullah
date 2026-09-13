export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;
  const wants = await prisma.wantPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      customer: { select: { name: true, email: true } },
      _count: { select: { offers: true } },
    },
  });
  return NextResponse.json({
    wants: wants.map((want) => ({
      ...want,
      budgetMin: want.budgetMin == null ? null : Number(want.budgetMin),
      budgetMax: want.budgetMax == null ? null : Number(want.budgetMax),
      offerCount: want._count.offers,
      _count: undefined,
    })),
  });
}
