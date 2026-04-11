export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireVendorSessionApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";
import {
  paymentMethodLabel,
  serializeVendorShopOrder,
} from "@/lib/vendor-shop-order-helpers";

type Ctx = { params: Promise<{ id: string }> };

/** Vendor: single bundled order (GET /api/orders/vendor/:id). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireVendorSessionApi();
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;
  const row = await prisma.vendorShopOrder.findFirst({
    where: { id, vendorId: auth.vendor.id },
    include: {
      order: { select: { orderNumber: true } },
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
