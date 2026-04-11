import { prisma } from "@/lib/prisma";
import type { VendorShopOrderStatus } from "@prisma/client";
import {
  notifyCustomerDelivered,
  notifyCustomerShipped,
} from "@/lib/order-emails";
import { createVendorEarningForDeliveredShopOrder } from "@/lib/vendor-earning-service";
import { createVendorNotification } from "@/lib/vendor-notifications";

/**
 * Side effects after vendor advances (or admin mirrors) a shop order status.
 * Fire-and-forget friendly: callers should void this and catch logs.
 */
export async function runAfterVendorShopOrderStatusChange(params: {
  shopOrderId: string;
  newStatus: VendorShopOrderStatus;
}): Promise<void> {
  const { shopOrderId, newStatus } = params;

  const row = await prisma.vendorShopOrder.findUnique({
    where: { id: shopOrderId },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerEmail: true,
          totalAmount: true,
          orderStatus: true,
        },
      },
      vendor: { select: { id: true, shopName: true } },
    },
  });
  if (!row?.order) return;

  const payload = {
    orderNumber: row.order.orderNumber,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    totalAmount: Number(row.order.totalAmount),
    trackingNumber: row.trackingNumber,
    shopOrderNumber: row.shopOrderNumber,
  };

  if (newStatus === "shipped") {
    await notifyCustomerShipped(payload);
    return;
  }

  if (newStatus === "delivered") {
    try {
      await createVendorEarningForDeliveredShopOrder(shopOrderId);
    } catch (e) {
      console.error("createVendorEarningForDeliveredShopOrder", e);
    }

    const siblings = await prisma.vendorShopOrder.findMany({
      where: { orderId: row.orderId },
      select: { status: true },
    });
    const allDelivered =
      siblings.length > 0 &&
      siblings.every((s) => s.status === "delivered");

    if (allDelivered) {
      await prisma.order.update({
        where: { id: row.orderId },
        data: { orderStatus: "delivered" },
      });
      await notifyCustomerDelivered({
        orderNumber: row.order.orderNumber,
        customerName: row.customerName,
        customerEmail: row.customerEmail,
        totalAmount: Number(row.order.totalAmount),
      });
    }

    await createVendorNotification({
      vendorId: row.vendorId,
      type: "delivered_payout",
      title: "Payment processing started",
      message: `Order ${row.shopOrderNumber} is delivered. Your net earning for this bundle has been added to your available balance.`,
    });
  }
}
