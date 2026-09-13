import { Prisma } from "@prisma/client";

type ReleaseScope =
  | { orderId: string; vendorShopOrderId?: never }
  | { orderId?: never; vendorShopOrderId: string };

/**
 * Release reservations exactly once. The conditional state update is the
 * idempotency gate; all stock mutations occur in the same DB transaction.
 */
export async function releaseReservedInventory(
  tx: Prisma.TransactionClient,
  scope: ReleaseScope,
  reason: string
): Promise<number> {
  const rows = await tx.orderInventoryLine.findMany({
    where: {
      state: "reserved",
      ...(scope.orderId ? { orderId: scope.orderId } : {}),
      ...(scope.vendorShopOrderId
        ? { vendorShopOrderId: scope.vendorShopOrderId }
        : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  let released = 0;
  for (const row of rows) {
    const gate = await tx.orderInventoryLine.updateMany({
      where: { id: row.id, state: "reserved" },
      data: {
        state: "released",
        releasedAt: new Date(),
        releaseReason: reason,
      },
    });
    if (gate.count !== 1) continue;

    if (row.productId) {
      await tx.product.updateMany({
        where: { id: row.productId },
        data: { stock: { increment: row.quantity } },
      });
    }
    if (row.vendorProductId) {
      await tx.$executeRaw`
        UPDATE VendorProduct
        SET stock = stock + ${row.quantity},
            totalSold = GREATEST(0, totalSold - ${row.quantity})
        WHERE id = ${row.vendorProductId}
      `;
    }
    released += 1;
  }
  return released;
}

/** Delivered inventory is consumed and can no longer be restored by cancel. */
export async function consumeReservedInventory(
  tx: Prisma.TransactionClient,
  scope: ReleaseScope
): Promise<number> {
  const rows = await tx.orderInventoryLine.findMany({
    where: {
      state: "reserved",
      ...(scope.orderId ? { orderId: scope.orderId } : {}),
      ...(scope.vendorShopOrderId
        ? { vendorShopOrderId: scope.vendorShopOrderId }
        : {}),
    },
    include: {
      order: { select: { customerId: true } },
      orderItem: { select: { id: true, name: true, quantity: true } },
      product: { select: { warrantyMonths: true } },
      vendorProduct: { select: { vendorId: true, warrantyMonths: true } },
    },
  });
  let consumed = 0;
  for (const row of rows) {
    const gate = await tx.orderInventoryLine.updateMany({
      where: { id: row.id, state: "reserved" },
      data: { state: "consumed" },
    });
    if (gate.count !== 1) continue;
    consumed += 1;

    const months = row.vendorProduct?.warrantyMonths ?? row.product?.warrantyMonths;
    if (row.order.customerId && months && months > 0) {
      const startsAt = new Date();
      const expiresAt = new Date(startsAt);
      expiresAt.setUTCMonth(expiresAt.getUTCMonth() + months);
      await tx.warrantyRecord.upsert({
        where: { orderItemId: row.orderItemId },
        update: {},
        create: {
          customerId: row.order.customerId,
          orderId: row.orderId,
          orderItemId: row.orderItemId,
          productId: row.productId,
          vendorId: row.vendorProduct?.vendorId ?? null,
          productName: row.orderItem.name,
          quantity: row.orderItem.quantity,
          startsAt,
          expiresAt,
        },
      });
    }
  }
  return consumed;
}
