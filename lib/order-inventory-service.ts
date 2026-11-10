import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";

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

  // Seller lines that were never confirmed never took stock: close them without restoring anything.
  await tx.orderInventoryLine.updateMany({
    where: {
      state: "awaiting_confirmation",
      ...(scope.orderId ? { orderId: scope.orderId } : {}),
      ...(scope.vendorShopOrderId
        ? { vendorShopOrderId: scope.vendorShopOrderId }
        : {}),
    },
    data: { state: "released", releasedAt: new Date(), releaseReason: reason },
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
        UPDATE vendorproduct
        SET stock = stock + ${row.quantity},
            totalSold = GREATEST(0, totalSold - ${row.quantity})
        WHERE id = ${row.vendorProductId}
      `;
    }
    released += 1;
  }
  return released;
}

/**
 * Seller confirmation: deduct the stock for the seller's lines (e.g. 10 → 9) and mark them
 * reserved, so a later cancellation restores it. Throws 409 when the stock is no longer
 * enough; the caller's transaction then rolls back and the order stays pending.
 */
export async function deductSellerInventoryOnConfirm(
  tx: Prisma.TransactionClient,
  vendorShopOrderId: string
): Promise<number> {
  const rows = await tx.orderInventoryLine.findMany({
    where: { vendorShopOrderId, state: "awaiting_confirmation" },
    include: { orderItem: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  let deducted = 0;
  for (const row of rows) {
    const gate = await tx.orderInventoryLine.updateMany({
      where: { id: row.id, state: "awaiting_confirmation" },
      data: { state: "reserved" },
    });
    if (gate.count !== 1) continue;

    const outOfStock = () =>
      new ApiError(409, `Not enough stock to confirm "${row.orderItem.name}" (needs ${row.quantity}). Add stock or cancel this order.`);
    if (row.vendorProductId) {
      const listing = await tx.vendorProduct.updateMany({
        where: { id: row.vendorProductId, stock: { gte: row.quantity } },
        data: { stock: { decrement: row.quantity }, totalSold: { increment: row.quantity } },
      });
      if (listing.count !== 1) throw outOfStock();
    }
    if (row.productId) {
      const storefront = await tx.product.updateMany({
        where: { id: row.productId, stock: { gte: row.quantity } },
        data: { stock: { decrement: row.quantity } },
      });
      if (storefront.count !== 1) throw outOfStock();
    }
    deducted += 1;
  }
  return deducted;
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
