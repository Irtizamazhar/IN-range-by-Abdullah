export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireApprovedVendorApi, requireVendorSessionApi } from "@/lib/vendor-api-auth";
import { sameOrigin, ApiError } from "@/lib/marketplace-api";
import { deleteShopOrderForVendor } from "@/lib/vendor-shop-order-service";
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
    where: { id, vendorId: auth.vendor.id, vendorDeletedAt: null },
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

/** Vendor: delete an order from the dashboard; active orders are cancelled first (DELETE /api/orders/vendor/:id). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    sameOrigin(req);
    const auth = await requireApprovedVendorApi();
    if ("response" in auth) return auth.response;
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 2000) : undefined;
    const result = await deleteShopOrderForVendor({ shopOrderId: id, vendorId: auth.vendor.id, reason });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("DELETE /api/orders/vendor/[id]", e instanceof Error ? e.name : "Unknown error");
    return NextResponse.json({ error: "The order could not be deleted. Nothing was changed." }, { status: 500 });
  }
}
