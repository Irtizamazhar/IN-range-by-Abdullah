export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireAdminPermission("customers.view");
  if ("response" in auth) return auth.response;
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const status = req.nextUrl.searchParams.get("status");
  const rows = await prisma.customer.findMany({
    where: {
      ...(status === "active" ? { isActive: true } : status === "suspended" ? { isActive: false } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 250,
    include: {
      orders: {
        select: {
          totalAmount: true,
          orderStatus: true,
          refunds: {
            where: { status: "processed" },
            select: { amount: true },
          },
        },
      },
      _count: { select: { orders: true, wants: true, returnRequests: true, disputes: true, savedProducts: true, storeFollows: true } },
    },
  });
  return NextResponse.json({
    customers: rows.map((row) => ({
      id: row.id, name: row.name, email: row.email, phone: row.phone,
      image: row.image, provider: row.provider, isActive: row.isActive,
      adminNote: row.adminNote, createdAt: row.createdAt.toISOString(),
      totalSpent: row.orders
        .filter((order) => order.orderStatus !== "cancelled")
        .reduce(
          (sum, order) =>
            sum +
            Math.max(
              0,
              Number(order.totalAmount) -
                order.refunds.reduce(
                  (refundTotal, refund) => refundTotal + Number(refund.amount),
                  0
                )
            ),
          0
        ),
      counts: row._count,
    })),
  });
}
