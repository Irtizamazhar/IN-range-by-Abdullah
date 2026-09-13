import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendStatusHistory, syncLineOrdersToShopStatus } from "@/lib/vendor-shop-order-helpers";
import { releaseReservedInventory } from "@/lib/order-inventory-service";
import { createCustomerNotification } from "@/lib/customer-notifications";

const CANCELLABLE = ["pending", "confirmed", "processing", "packed"];

async function reverseVendorSalesMetrics(
  tx: Prisma.TransactionClient,
  vendorShopOrderId: string,
  vendorId: string
) {
  const lines = await tx.vendorOrder.findMany({
    where: { vendorShopOrderId },
    select: { saleAmount: true },
  });
  const saleAmount = lines.reduce((sum, line) => sum + Number(line.saleAmount), 0);
  const orderCount = lines.length;
  if (!orderCount && !saleAmount) return;

  await tx.$executeRaw`
    UPDATE Vendor
    SET totalSales = GREATEST(0, totalSales - ${saleAmount}),
        totalOrders = GREATEST(0, totalOrders - ${orderCount})
    WHERE id = ${vendorId}
  `;
}

async function cancelShopInsideTransaction(
  tx: Prisma.TransactionClient,
  shop: {
    id: string;
    vendorId: string;
    status: string;
    statusHistory: Prisma.JsonValue;
  },
  reason: string
): Promise<boolean> {
  if (shop.status === "cancelled") return false;
  if (!CANCELLABLE.includes(shop.status)) {
    throw new Error("Shipped or delivered seller orders cannot be cancelled");
  }

  const history = appendStatusHistory(shop.statusHistory, {
    status: "cancelled",
    updatedAt: new Date().toISOString(),
    note: reason,
  });
  const gate = await tx.vendorShopOrder.updateMany({
    where: {
      id: shop.id,
      status: shop.status as "pending" | "confirmed" | "packed",
    },
    data: {
      status: "cancelled",
      cancelReason: reason,
      statusHistory: history as Prisma.InputJsonValue,
    },
  });
  if (gate.count !== 1) throw new Error("Order status changed; refresh and try again");

  await syncLineOrdersToShopStatus(tx, shop.id, "cancelled", undefined);
  await releaseReservedInventory(tx, { vendorShopOrderId: shop.id }, reason);
  await reverseVendorSalesMetrics(tx, shop.id, shop.vendorId);
  return true;
}

export async function cancelParentOrder(params: {
  orderId: string;
  reason: string;
  actorType: "customer" | "admin" | "system";
  actorId?: string | null;
  customerId?: string;
}): Promise<
  | { ok: true; alreadyCancelled: boolean }
  | { ok: false; error: string }
> {
  const reason = params.reason.trim();
  if (!reason) return { ok: false, error: "Cancellation reason is required" };

  const order = await prisma.order.findFirst({
    where: {
      id: params.orderId,
      ...(params.customerId ? { customerId: params.customerId } : {}),
    },
    include: { vendorShopOrders: true },
  });
  if (!order) return { ok: false, error: "Not found" };
  if (order.orderStatus === "cancelled") {
    return { ok: true, alreadyCancelled: true };
  }
  if (!CANCELLABLE.includes(order.orderStatus)) {
    return { ok: false, error: "Shipped or delivered orders cannot be cancelled" };
  }
  if (
    params.actorType === "customer" &&
    ["received", "partially_refunded"].includes(order.paymentStatus)
  ) {
    return {
      ok: false,
      error: "This paid order needs a refund review. Please contact support.",
    };
  }
  if (order.vendorShopOrders.some((shop) => !CANCELLABLE.includes(shop.status))) {
    return { ok: false, error: "A seller has already shipped this order" };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const gate = await tx.order.updateMany({
          where: { id: order.id, orderStatus: order.orderStatus },
          data: {
            orderStatus: "cancelled",
            cancelledAt: new Date(),
            cancelReason: reason,
            ...(order.paymentStatus === "pending"
              ? { paymentStatus: "failed" }
              : {}),
          },
        });
        if (gate.count !== 1) {
          throw new Error("Order status changed; refresh and try again");
        }

        for (const shop of order.vendorShopOrders) {
          await cancelShopInsideTransaction(tx, shop, reason);
        }
        // Releases internal inventory and safely skips seller lines already released above.
        await releaseReservedInventory(tx, { orderId: order.id }, reason);

        await tx.orderStatusEvent.create({
          data: {
            orderId: order.id,
            actorType: params.actorType,
            actorId: params.actorId ?? null,
            eventType: "order_cancelled",
            fromStatus: order.orderStatus,
            toStatus: "cancelled",
            idempotencyKey: `cancel:${order.id}`,
            details: { reason },
          },
        });
        if (order.customerId) {
          await createCustomerNotification({
            customerId: order.customerId,
            type: "order_cancelled",
            title: "Order cancelled",
            message: `${order.orderNumber} was cancelled. ${reason}`,
            link: `/track-order?order=${encodeURIComponent(order.orderNumber)}`,
            idempotencyKey: `order-cancelled:${order.id}:customer`,
          }, tx);
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return { ok: true, alreadyCancelled: false };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Cancellation failed",
    };
  }
}

export async function cancelSellerOrder(params: {
  shopOrderId: string;
  reason: string;
  vendorId?: string;
  actorType: "vendor" | "admin" | "system";
  actorId?: string | null;
}): Promise<
  | { ok: true; alreadyCancelled: boolean }
  | { ok: false; error: string }
> {
  const reason = params.reason.trim();
  if (!reason) return { ok: false, error: "Cancellation reason is required" };

  const shop = await prisma.vendorShopOrder.findFirst({
    where: {
      id: params.shopOrderId,
      ...(params.vendorId ? { vendorId: params.vendorId } : {}),
    },
  });
  if (!shop) return { ok: false, error: "Not found" };
  if (shop.status === "cancelled") return { ok: true, alreadyCancelled: true };
  if (!CANCELLABLE.includes(shop.status)) {
    return { ok: false, error: "Shipped or delivered orders cannot be cancelled" };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await cancelShopInsideTransaction(tx, shop, reason);

        const siblings = await tx.vendorShopOrder.findMany({
          where: { orderId: shop.orderId },
          select: { status: true },
        });
        const internalReserved = await tx.orderInventoryLine.count({
          where: {
            orderId: shop.orderId,
            vendorShopOrderId: null,
            state: "reserved",
          },
        });
        if (
          internalReserved === 0 &&
          siblings.length > 0 &&
          siblings.every((row) => row.status === "cancelled")
        ) {
          const parent = await tx.order.findUnique({ where: { id: shop.orderId } });
          if (parent && CANCELLABLE.includes(parent.orderStatus)) {
            await tx.order.update({
              where: { id: parent.id },
              data: {
                orderStatus: "cancelled",
                cancelledAt: new Date(),
                cancelReason: reason,
                ...(parent.paymentStatus === "pending"
                  ? { paymentStatus: "failed" }
                  : {}),
              },
            });
          }
        }

        await tx.orderStatusEvent.create({
          data: {
            orderId: shop.orderId,
            actorType: params.actorType,
            actorId: params.actorId ?? null,
            eventType: "seller_order_cancelled",
            fromStatus: shop.status,
            toStatus: "cancelled",
            idempotencyKey: `shop-cancel:${shop.id}`,
            details: { reason, shopOrderId: shop.id },
          },
        });
        if (shop.customerId) {
          await createCustomerNotification({
            customerId: shop.customerId,
            type: "seller_order_cancelled",
            title: "A seller delivery was cancelled",
            message: `${shop.shopOrderNumber} was cancelled. ${reason}`,
            link: `/track-order?order=${encodeURIComponent(shop.shopOrderNumber)}`,
            idempotencyKey: `shop-cancelled:${shop.id}:customer`,
          }, tx);
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return { ok: true, alreadyCancelled: false };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Cancellation failed",
    };
  }
}
