export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { Prisma, VendorShopOrderStatus } from "@prisma/client";
import { requireVendorSessionApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";
import {
  buildShopOrderStatusCounts,
  paymentMethodLabel,
  serializeVendorShopOrder,
} from "@/lib/vendor-shop-order-helpers";

async function shopOrderCountsForVendor(vendorId: string) {
  const groups = await prisma.vendorShopOrder.groupBy({
    by: ["status"],
    where: { vendorId },
    _count: { _all: true },
  });
  return buildShopOrderStatusCounts(groups);
}

/** Vendor: list bundled shop orders (GET /api/orders/vendor). */
export async function GET(req: NextRequest) {
  const auth = await requireVendorSessionApi();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(req.url);

  if (searchParams.get("countsOnly") === "1") {
    const counts = await shopOrderCountsForVendor(auth.vendor.id);
    return NextResponse.json({ counts });
  }

  const status = searchParams.get("status");
  const q = (searchParams.get("q") || "").trim();

  const where: Prisma.VendorShopOrderWhereInput = {
    vendorId: auth.vendor.id,
  };

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

  const [rows, counts] = await Promise.all([
    prisma.vendorShopOrder.findMany({
      where,
      orderBy: { placedAt: "desc" },
      take: 300,
      include: {
        order: { select: { orderNumber: true } },
      },
    }),
    shopOrderCountsForVendor(auth.vendor.id),
  ]);

  const orders = rows.map((r) => {
    const s = serializeVendorShopOrder(r);
    const itemCount = s.items.reduce((n, i) => n + i.quantity, 0);
    return {
      ...s,
      itemCount,
      paymentMethodLabel: paymentMethodLabel(s.paymentMethod),
    };
  });

  return NextResponse.json({ orders, counts });
}
