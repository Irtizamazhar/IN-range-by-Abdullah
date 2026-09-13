export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { DISPUTE_INCLUDE, serializeDispute } from "@/lib/after-sales";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-rbac";

export async function GET(req: NextRequest) {
  const auth = await requireAdminPermission("disputes.manage");
  if ("response" in auth) return auth.response;
  const status = req.nextUrl.searchParams.get("status")?.trim();
  const rows = await prisma.dispute.findMany({
    where: status && status !== "all" ? { status: status as never } : undefined,
    orderBy: { createdAt: "desc" },
    take: 250,
    include: {
      ...DISPUTE_INCLUDE,
      customer: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  return NextResponse.json({
    disputes: rows.map((row) => ({ ...serializeDispute(row), customer: row.customer })),
  });
}
