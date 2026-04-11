export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import {
  advanceVendorShopOrderStatus,
  updateShippedTrackingOnly,
} from "@/lib/vendor-shop-order-service";
import { runAfterVendorShopOrderStatusChange } from "@/lib/after-vendor-shop-order-status";

const bodySchema = z.object({
  note: z.string().max(500).optional(),
  trackingNumber: z.union([z.string().max(255), z.null()]).optional(),
  /** When true, only updates tracking (order must already be `shipped`). */
  updateTrackingOnly: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/** Vendor: next status or tracking-only update (PATCH /api/orders/vendor/:id/status). */
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

  const { note, trackingNumber, updateTrackingOnly } = parsed.data;

  if (updateTrackingOnly) {
    const res = await updateShippedTrackingOnly({
      shopOrderId: id,
      vendorId: auth.vendor.id,
      trackingNumber:
        trackingNumber === undefined ? null : trackingNumber,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const res = await advanceVendorShopOrderStatus({
    shopOrderId: id,
    vendorId: auth.vendor.id,
    note,
    trackingNumber,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  void runAfterVendorShopOrderStatusChange({
    shopOrderId: id,
    newStatus: res.newStatus,
  }).catch((e) => console.error("runAfterVendorShopOrderStatusChange", e));

  return NextResponse.json({ ok: true, newStatus: res.newStatus });
}
