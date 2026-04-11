export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/sessions";
import { autoCancelStaleBankOrders } from "@/lib/auto-cancel-orders";
import { findOrderByIdOrNumber } from "@/lib/find-order";
import {
  notifyCustomerOrderConfirmed,
  notifyCustomerOrderCancelled,
  notifyCustomerPaymentRejected,
  notifyCustomerShipped,
} from "@/lib/order-emails";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serialize";

type Ctx = { params: { id: string } };

export async function GET(req: NextRequest, context: Ctx) {
  await autoCancelStaleBankOrders();
  const { id } = context.params;
  const session = await getAdminSession();
  /** Admin panel must pass `?admin=1` so vendor-facing merge is not applied while browsing as admin. */
  const forAdmin =
    session?.user?.role === "admin" &&
    req.nextUrl.searchParams.get("admin") === "1";

  const order = await findOrderByIdOrNumber(id);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ref = id.trim().toUpperCase();
  const vendorShopOrderRef =
    !forAdmin && ref.startsWith("IRV-") ? ref : undefined;
  return NextResponse.json(
    serializeOrder(order, { forAdmin, vendorShopOrderRef })
  );
}

export async function PUT(req: NextRequest, context: Ctx) {
  await autoCancelStaleBankOrders();
  const { id } = context.params;
  const session = await getAdminSession();
  const body = await req.json();

  const order = await findOrderByIdOrNumber(id);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (session?.user?.role === "admin") {
    const prevStatus = order.orderStatus;
    const prevPayment = order.paymentStatus;

    const data: Prisma.OrderUpdateInput = {};
    if (body.isRead === true) data.isRead = true;
    if (body.orderStatus != null && body.orderStatus !== "") {
      data.orderStatus = body.orderStatus;
    }
    if (body.paymentStatus != null && body.paymentStatus !== "") {
      data.paymentStatus = body.paymentStatus;
    }
    if (body.paymentRejectedReason !== undefined) {
      data.paymentRejectedReason = body.paymentRejectedReason;
    }
    if (body.trackingNumber !== undefined) {
      data.trackingNumber = body.trackingNumber;
    }
    if (body.notes !== undefined) {
      data.notes = body.notes;
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data,
      include: { orderItems: true },
    });

    const payload = {
      orderNumber: updated.orderNumber,
      customerName: updated.customerName,
      customerEmail: updated.customerEmail,
      totalAmount: Number(updated.totalAmount),
      trackingNumber: updated.trackingNumber,
    };

    if (prevStatus !== "confirmed" && updated.orderStatus === "confirmed") {
      await notifyCustomerOrderConfirmed(payload);
    }
    if (prevStatus !== "shipped" && updated.orderStatus === "shipped") {
      await notifyCustomerShipped(payload);
    }
    if (
      prevPayment !== "rejected" &&
      updated.paymentStatus === "rejected" &&
      updated.paymentRejectedReason
    ) {
      await notifyCustomerPaymentRejected(
        payload,
        updated.paymentRejectedReason
      );
    }
    if (prevStatus !== "cancelled" && updated.orderStatus === "cancelled") {
      await notifyCustomerOrderCancelled(payload);
    }

    return NextResponse.json(serializeOrder(updated, { forAdmin: true }));
  }

  const phoneOk =
    body.customerPhone && body.customerPhone === order.customerPhone;

  if (
    body.paymentProofStagingId &&
    phoneOk &&
    order.paymentMethod === "bank_transfer"
  ) {
    const st = await prisma.paymentProofStaging.findUnique({
      where: { id: String(body.paymentProofStagingId) },
    });
    if (!st) {
      return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
    }
    const raw = new Uint8Array(st.data);
    const proof = new Uint8Array(raw.byteLength);
    proof.set(raw);
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentProofData: proof as Uint8Array<ArrayBuffer>,
        paymentProofMime: st.mimeType,
        paymentScreenshot: null,
      },
      include: { orderItems: true },
    });
    await prisma.paymentProofStaging.delete({ where: { id: st.id } });
    const { notifyAdminScreenshotUploaded } = await import("@/lib/order-emails");
    await notifyAdminScreenshotUploaded({
      orderNumber: updated.orderNumber,
      customerName: updated.customerName,
      customerEmail: updated.customerEmail,
      totalAmount: Number(updated.totalAmount),
    });
    return NextResponse.json(serializeOrder(updated));
  }

  if (body.paymentScreenshot && phoneOk) {
    if (order.paymentMethod !== "bank_transfer") {
      return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentScreenshot: String(body.paymentScreenshot),
        paymentProofData: null,
        paymentProofMime: null,
      },
      include: { orderItems: true },
    });
    const { notifyAdminScreenshotUploaded } = await import("@/lib/order-emails");
    await notifyAdminScreenshotUploaded({
      orderNumber: updated.orderNumber,
      customerName: updated.customerName,
      customerEmail: updated.customerEmail,
      totalAmount: Number(updated.totalAmount),
    });
    return NextResponse.json(serializeOrder(updated));
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
