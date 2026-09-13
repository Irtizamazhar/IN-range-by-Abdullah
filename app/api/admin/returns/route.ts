export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { RETURN_INCLUDE, serializeReturn } from "@/lib/after-sales";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/admin-rbac";

export async function GET(req: NextRequest) {
  const auth = await requireAdminPermission("returns.manage");
  if ("response" in auth) return auth.response;
  const status = req.nextUrl.searchParams.get("status")?.trim();
  const rows = await prisma.returnRequest.findMany({
    where: status && status !== "all"
      ? { status: status as never }
      : undefined,
    orderBy: { requestedAt: "desc" },
    take: 250,
    include: {
      ...RETURN_INCLUDE,
      customer: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  return NextResponse.json({
    returns: rows.map((row) => ({
      ...serializeReturn(row),
      customer: row.customer,
      maximumRefund: Number(row.orderItem.price) * row.quantity,
    })),
  });
}
