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
<<<<<<< Updated upstream
          totalAmount: true,
          handlingFee: true,
          orderItems: {
            select: { quantity: true, price: true, name: true, image: true },
          },
=======
>>>>>>> Stashed changes
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const order = serializeVendorShopOrder(row);
<<<<<<< Updated upstream
  const parentSubtotal = (row.order?.orderItems || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
  const checkoutTotalAmount = Number(row.order?.totalAmount || 0);
  const handlingFee = Number(row.order?.handlingFee ?? 0);
  const deliveryCharge = Math.max(0, checkoutTotalAmount - parentSubtotal - handlingFee);
=======
>>>>>>> Stashed changes
  return NextResponse.json({
    order: {
      ...order,
      paymentMethodLabel: paymentMethodLabel(order.paymentMethod),
      labelItems: order.items.slice(0, 4).map((item) => ({
        name: item.productName,
        image: item.image ? String(item.image) : null,
        quantity: Number(item.quantity || 0),
      })),
    },
  });
}
