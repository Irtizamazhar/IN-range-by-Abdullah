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
      order: {
        select: {
          orderNumber: true,
          totalAmount: true,
          orderItems: {
            select: { quantity: true, price: true, name: true, image: true },
          },
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const order = serializeVendorShopOrder(row);
  const parentSubtotal = (row.order?.orderItems || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
  const checkoutTotalAmount = Number(row.order?.totalAmount || 0);
  const deliveryCharge = Math.max(0, checkoutTotalAmount - parentSubtotal);
  return NextResponse.json({
    order: {
      ...order,
      paymentMethodLabel: paymentMethodLabel(order.paymentMethod),
      deliveryCharge: deliveryCharge.toString(),
      checkoutTotalAmount: checkoutTotalAmount.toString(),
      labelItems: (row.order?.orderItems || []).slice(0, 4).map((item) => ({
        name: String(item.name || "Product"),
        image: item.image ? String(item.image) : null,
        quantity: Number(item.quantity || 0),
      })),
    },
  });
}
