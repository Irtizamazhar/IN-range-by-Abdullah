export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import {
  paymentMethodLabel,
  serializeVendorShopOrder,
} from "@/lib/vendor-shop-order-helpers";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: shop-order detail with vendor block (GET /api/orders/admin/shop/:id). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireAdminPermission("orders.view");
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  const row = await prisma.vendorShopOrder.findUnique({
    where: { id },
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

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const order = serializeVendorShopOrder(row);
  return NextResponse.json({
    order: {
      ...order,
      paymentMethodLabel: paymentMethodLabel(order.paymentMethod),
    },
  });
}
