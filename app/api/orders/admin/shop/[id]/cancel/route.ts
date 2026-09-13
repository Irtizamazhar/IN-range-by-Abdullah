export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { cancelVendorShopOrder } from "@/lib/vendor-shop-order-service";
import { prisma } from "@/lib/prisma";
import { createVendorNotification } from "@/lib/vendor-notifications";

const bodySchema = z.object({
  reason: z.string().min(1).max(2000),
});

type Ctx = { params: Promise<{ id: string }> };

/** Admin: force-cancel any non-delivered shop order (PATCH). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdminPermission("orders.manage");
  if ("response" in auth) return auth.response;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const first =
      Object.values(parsed.error.flatten().fieldErrors).flat()[0] ||
      parsed.error.message;
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const row = await prisma.vendorShopOrder.findUnique({
    where: { id },
    select: { vendorId: true, shopOrderNumber: true },
  });

  const res = await cancelVendorShopOrder({
    shopOrderId: id,
    reason: parsed.data.reason,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  if (row) {
    await createVendorNotification({
      vendorId: row.vendorId,
      type: "order_cancelled",
      title: "Order cancelled",
      message: `Order ${row.shopOrderNumber} was cancelled by admin.`,
    });
  }

  return NextResponse.json({ ok: true });
}
