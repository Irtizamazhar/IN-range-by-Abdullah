import { Prisma, type VendorShopOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  appendStatusHistory,
  nextShopStatus,
  syncLineOrdersToShopStatus,
} from "@/lib/vendor-shop-order-helpers";

/**
 * Advance shop order one step in the linear flow (vendor).
 * Optionally attach courier tracking when entering `shipped`.
 */
export async function advanceVendorShopOrderStatus(params: {
  shopOrderId: string;
  vendorId: string;
  note?: string;
  trackingNumber?: string | null;
}): Promise<{ ok: true; newStatus: VendorShopOrderStatus } | { ok: false; error: string }> {
  const { shopOrderId, vendorId, note, trackingNumber } = params;

  const row = await prisma.vendorShopOrder.findFirst({
    where: { id: shopOrderId, vendorId },
  });
  if (!row) {
    return { ok: false, error: "Not found" };
  }

  const next = nextShopStatus(row.status);
  if (!next) {
    return {
      ok: false,
      error: "No further status transitions allowed from current state",
    };
  }

  const history = appendStatusHistory(row.statusHistory, {
    status: next,
    updatedAt: new Date().toISOString(),
    note: note?.trim() || `Moved to ${next}`,
  });

  const data: Prisma.VendorShopOrderUpdateInput = {
    status: next,
    statusHistory: history as Prisma.InputJsonValue,
  };

  if (next === "shipped" && trackingNumber !== undefined) {
    data.trackingNumber =
      trackingNumber === null || trackingNumber === ""
        ? null
        : trackingNumber.trim();
  }

  await prisma.$transaction(async (tx) => {
    await tx.vendorShopOrder.update({
      where: { id: shopOrderId },
      data,
    });
    await syncLineOrdersToShopStatus(
      tx,
      shopOrderId,
      next,
      next === "shipped" ? trackingNumber : undefined
    );
  });

  return { ok: true, newStatus: next };
}

/** Update courier reference after the order is already shipped (no status change). */
export async function updateShippedTrackingOnly(params: {
  shopOrderId: string;
  vendorId: string;
  trackingNumber: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { shopOrderId, vendorId, trackingNumber } = params;
  const row = await prisma.vendorShopOrder.findFirst({
    where: { id: shopOrderId, vendorId },
  });
  if (!row) {
    return { ok: false, error: "Not found" };
  }
  if (row.status !== "shipped") {
    return { ok: false, error: "Tracking can only be edited while status is shipped" };
  }
  const tn =
    trackingNumber === null || trackingNumber === ""
      ? null
      : trackingNumber.trim();

  await prisma.$transaction(async (tx) => {
    await tx.vendorShopOrder.update({
      where: { id: shopOrderId },
      data: { trackingNumber: tn },
    });
    await tx.vendorOrder.updateMany({
      where: { vendorShopOrderId: shopOrderId },
      data: { trackingNumber: tn },
    });
  });
  return { ok: true };
}

/** Cancel a shop bundle (vendor or admin). Delivered orders cannot be cancelled. */
export async function cancelVendorShopOrder(params: {
  shopOrderId: string;
  reason: string;
  /** When set, only this vendor may cancel (vendor flow). */
  vendorId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { shopOrderId, reason, vendorId } = params;
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, error: "Cancellation reason is required" };
  }

  const row = await prisma.vendorShopOrder.findFirst({
    where: vendorId ? { id: shopOrderId, vendorId } : { id: shopOrderId },
  });
  if (!row) {
    return { ok: false, error: "Not found" };
  }
  if (row.status === "cancelled") {
    return { ok: false, error: "Already cancelled" };
  }
  if (row.status === "delivered") {
    return { ok: false, error: "Delivered orders cannot be cancelled" };
  }

  const history = appendStatusHistory(row.statusHistory, {
    status: "cancelled",
    updatedAt: new Date().toISOString(),
    note: trimmed,
  });

  await prisma.$transaction(async (tx) => {
    await tx.vendorShopOrder.update({
      where: { id: shopOrderId },
      data: {
        status: "cancelled",
        cancelReason: trimmed,
        statusHistory: history as Prisma.InputJsonValue,
      },
    });
    await syncLineOrdersToShopStatus(tx, shopOrderId, "cancelled", undefined);
  });

  return { ok: true };
}
