export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { Prisma, VendorShopOrderStatus } from "@prisma/client";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";
import {
  paymentMethodLabel,
  serializeVendorShopOrder,
} from "@/lib/vendor-shop-order-helpers";

/** Admin: all vendor shop orders with filters (GET /api/orders/admin/all). */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const vendorId = searchParams.get("vendorId");
  const q = (searchParams.get("q") || "").trim();
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: Prisma.VendorShopOrderWhereInput = {};

  if (vendorId) {
    where.vendorId = vendorId;
  }

  const shopStatuses: VendorShopOrderStatus[] = [
    "pending",
    "confirmed",
    "packed",
    "shipped",
    "delivered",
    "cancelled",
  ];
  if (
    status &&
    status !== "all" &&
    shopStatuses.includes(status as VendorShopOrderStatus)
  ) {
    where.status = status as VendorShopOrderStatus;
  }

  if (q) {
    where.OR = [
      { shopOrderNumber: { contains: q } },
      { customerName: { contains: q } },
    ];
  }

  const placedFilter: Prisma.DateTimeFilter = {};
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (!Number.isNaN(d.getTime())) placedFilter.gte = d;
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      placedFilter.lte = d;
    }
  }
  if (Object.keys(placedFilter).length > 0) {
    where.placedAt = placedFilter;
  }

  const rows = await prisma.vendorShopOrder.findMany({
    where,
    orderBy: { placedAt: "desc" },
    take: 500,
    include: {
      order: { select: { orderNumber: true } },
      vendor: {
        select: {
          id: true,
          shopName: true,
          ownerName: true,
          email: true,
          phone: true,
          city: true,
        },
      },
    },
  });

  const orders = rows.map((r) => {
    const s = serializeVendorShopOrder(r);
    const itemCount = s.items.reduce((n, i) => n + i.quantity, 0);
    return {
      ...s,
      itemCount,
      paymentMethodLabel: paymentMethodLabel(s.paymentMethod),
    };
  });

  return NextResponse.json({ orders });
}
