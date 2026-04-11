export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { cancelVendorShopOrder } from "@/lib/vendor-shop-order-service";

const bodySchema = z.object({
  reason: z.string().min(1).max(2000),
});

type Ctx = { params: Promise<{ id: string }> };

/** Vendor: cancel with reason (PATCH /api/orders/vendor/:id/cancel). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireApprovedVendorApi();
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

  const res = await cancelVendorShopOrder({
    shopOrderId: id,
    reason: parsed.data.reason,
    vendorId: auth.vendor.id,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
