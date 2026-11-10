export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireVendorSessionApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";
import {
  paymentMethodLabel,
  serializeVendorShopOrder,
  vendorShopOrderView,
} from "@/lib/vendor-shop-order-helpers";

type Ctx = { params: Promise<{ id: string }> };

/** Vendor: single bundled order (GET /api/orders/vendor/:id). Customer identity is never included. */
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
        },
      },
      pickupRequest: { select: { status: true, pickupReference: true } },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const order = vendorShopOrderView(serializeVendorShopOrder(row));
  const listingIds = order.items.flatMap((item) => (item.vendorProductId ? [item.vendorProductId] : []));
  const listings = listingIds.length
    ? await prisma.vendorProduct.findMany({
        where: { id: { in: listingIds }, vendorId: auth.vendor.id },
        select: { id: true, description: true },
      })
    : [];
  const descriptionById = new Map(listings.map((listing) => [listing.id, listing.description]));

  return NextResponse.json({
    order: {
      ...order,
      items: order.items.map((item) => ({
        ...item,
        description: item.vendorProductId ? descriptionById.get(item.vendorProductId) ?? null : null,
      })),
      paymentMethodLabel: paymentMethodLabel(order.paymentMethod),
    },
  });
}
