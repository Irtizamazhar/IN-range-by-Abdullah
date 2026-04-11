export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireVendorSessionApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";

/** Marketplace-style: seller sees only their sub-orders (Daraz-style split). */
export async function GET(req: NextRequest) {
  const auth = await requireVendorSessionApi();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const where = {
    vendorId: auth.vendor.id,
    ...(status &&
    ["pending", "processing", "shipped", "delivered", "cancelled"].includes(
      status
    )
      ? { status: status as "pending" | "processing" | "shipped" | "delivered" | "cancelled" }
      : {}),
  };

  const rows = await prisma.vendorOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
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
        select: { productName: true },
      },
    },
  });

  return NextResponse.json({
    orders: rows.map((r) => ({
      id: r.id,
      status: r.status,
      quantity: r.quantity,
      saleAmount: r.saleAmount.toString(),
      commissionAmount: r.commissionAmount.toString(),
      vendorAmount: r.vendorAmount.toString(),
      commissionRate: r.commissionRate.toString(),
      trackingNumber: r.trackingNumber,
      createdAt: r.createdAt.toISOString(),
      productName: r.vendorProduct?.productName ?? "Product",
      order: {
        id: r.order.id,
        orderNumber: r.order.orderNumber,
        orderStatus: r.order.orderStatus,
        paymentStatus: r.order.paymentStatus,
        paymentMethod: r.order.paymentMethod,
        customerName: r.order.customerName,
        customerPhone: r.order.customerPhone,
        customerEmail: r.order.customerEmail,
        customerAddress: r.order.customerAddress,
        city: r.order.city,
        createdAt: r.order.createdAt.toISOString(),
      },
    })),
  });
}
