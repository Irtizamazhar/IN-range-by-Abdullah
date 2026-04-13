export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/sessions";
import {
  advanceVendorShopOrderStatus,
  updateShippedTrackingOnly,
} from "@/lib/vendor-shop-order-service";
import { runAfterVendorShopOrderStatusChange } from "@/lib/after-vendor-shop-order-status";

const bodySchema = z.object({
  note: z.string().max(500).optional(),
  trackingNumber: z.union([z.string().max(255), z.null()]).optional(),
  updateTrackingOnly: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/** Admin: packed→shipped (optional tracking) or shipped→delivered; or tracking-only while shipped. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getAdminSession();
    if (session?.user?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      if (trackingNumber === undefined) {
        return NextResponse.json(
          { error: "trackingNumber is required (string or null to clear)" },
          { status: 400 }
        );
      }
      const res = await updateShippedTrackingOnly({
        shopOrderId: id,
        actor: "admin",
        trackingNumber,
      });
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    const res = await advanceVendorShopOrderStatus({
      shopOrderId: id,
      actor: "admin",
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
  } catch (e) {
    console.error("PATCH /api/orders/admin/shop/[id]/status", e);
    return NextResponse.json(
      {
        error:
          "Could not update status. If the problem continues, run: npx prisma migrate deploy && npx prisma generate",
      },
      { status: 500 }
    );
  }
}
