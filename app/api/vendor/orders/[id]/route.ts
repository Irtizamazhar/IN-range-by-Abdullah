export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApprovedVendorApi, requireVendorSessionApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z
  .object({
    status: z.enum(["processing", "shipped", "delivered"]).optional(),
    trackingNumber: z.union([z.string().max(255), z.null()]).optional(),
  })
  .refine(
    (b) => b.status !== undefined || b.trackingNumber !== undefined,
    { message: "Nothing to update" }
  );

type Ctx = { params: { id: string } };

function canTransition(
  from: string,
  to: string
): boolean {
  const m: Record<string, string[]> = {
    pending: ["processing"],
    processing: ["shipped"],
    shipped: ["delivered"],
  };
  return m[from]?.includes(to) ?? false;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireVendorSessionApi();
  if ("response" in auth) return auth.response;

  const row = await prisma.vendorOrder.findFirst({
    where: { id: ctx.params.id, vendorId: auth.vendor.id },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          orderStatus: true,
          paymentStatus: true,
          paymentMethod: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          customerAddress: true,
          city: true,
          createdAt: true,
        },
      },
      vendorProduct: {
        select: { productName: true, id: true },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      id: row.id,
      status: row.status,
      quantity: row.quantity,
      saleAmount: row.saleAmount.toString(),
      commissionAmount: row.commissionAmount.toString(),
      vendorAmount: row.vendorAmount.toString(),
      commissionRate: row.commissionRate.toString(),
      trackingNumber: row.trackingNumber,
      createdAt: row.createdAt.toISOString(),
      productName: row.vendorProduct?.productName ?? "Product",
      vendorProductId: row.vendorProduct?.id ?? null,
      parentOrder: {
        id: row.order.id,
        orderNumber: row.order.orderNumber,
        orderStatus: row.order.orderStatus,
        paymentStatus: row.order.paymentStatus,
        paymentMethod: row.order.paymentMethod,
        customerName: row.order.customerName,
        customerPhone: row.order.customerPhone,
        customerEmail: row.order.customerEmail,
        customerAddress: row.order.customerAddress,
        city: row.order.city,
        createdAt: row.order.createdAt.toISOString(),
      },
    },
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const existing = await prisma.vendorOrder.findFirst({
    where: { id: ctx.params.id, vendorId: auth.vendor.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    const first = Object.values(msg).flat()[0] || parsed.error.message;
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const { status: nextStatus, trackingNumber } = parsed.data;

  if (nextStatus !== undefined && nextStatus != null) {
    if (!canTransition(existing.status, nextStatus)) {
      return NextResponse.json(
        {
          error: `Cannot change status from ${existing.status} to ${nextStatus}`,
        },
        { status: 400 }
      );
    }
  }

  if (
    nextStatus === undefined &&
    trackingNumber !== undefined &&
    !["processing", "shipped"].includes(existing.status)
  ) {
    return NextResponse.json(
      {
        error:
          "Tracking can only be updated while the order is processing or shipped",
      },
      { status: 400 }
    );
  }

  const data: {
    status?: "processing" | "shipped" | "delivered";
    trackingNumber?: string | null;
  } = {};

  if (nextStatus !== undefined && nextStatus != null) {
    data.status = nextStatus;
  }
  if (trackingNumber !== undefined) {
    data.trackingNumber =
      trackingNumber === null || trackingNumber === ""
        ? null
        : trackingNumber.trim();
  }

  try {
    const updated = await prisma.vendorOrder.update({
      where: { id: existing.id },
      data,
    });
    return NextResponse.json({
      ok: true,
      order: {
        id: updated.id,
        status: updated.status,
        trackingNumber: updated.trackingNumber,
      },
    });
  } catch (e) {
    console.error("vendor order patch", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
