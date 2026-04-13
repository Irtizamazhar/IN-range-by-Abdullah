import { Prisma, type VendorShopOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  appendStatusHistory,
  nextShopStatus,
  syncLineOrdersToShopStatus,
} from "@/lib/vendor-shop-order-helpers";

export type AdvanceShopOrderActor = "vendor" | "admin";

/**
 * Advance shop order one step. Vendors: only through `packed`. Admin: only
 * `packed`→`shipped` and `shipped`→`delivered`.
 */
export async function advanceVendorShopOrderStatus(params: {
  shopOrderId: string;
  actor: AdvanceShopOrderActor;
  /** Required when actor is `vendor` (ownership check). */
  vendorId?: string;
  note?: string;
  trackingNumber?: string | null;
}): Promise<
  { ok: true; newStatus: VendorShopOrderStatus } | { ok: false; error: string }
> {
  const { shopOrderId, actor, vendorId, note, trackingNumber } = params;

  const row = await prisma.vendorShopOrder.findUnique({
    where: { id: shopOrderId },
  });
  if (!row) {
    return { ok: false, error: "Not found" };
  }
  if (actor === "vendor") {
    if (!vendorId || row.vendorId !== vendorId) {
      return { ok: false, error: "Not found" };
    }
  }

  const next = nextShopStatus(row.status);
  if (!next) {
    return {
      ok: false,
      error: "No further status transitions allowed from current state",
    };
  }

  if (actor === "vendor") {
    if (next === "shipped" || next === "delivered") {
      return {
        ok: false,
        error:
          "Shipped and delivered are updated by the admin after you mark the order as packed.",
      };
    }
  } else {
    const okPackedToShipped = row.status === "packed" && next === "shipped";
    const okShippedToDelivered = row.status === "shipped" && next === "delivered";
    if (!okPackedToShipped && !okShippedToDelivered) {
      return {
        ok: false,
        error:
          "Admin can only mark Shipped (after Packed) or Delivered (after Shipped).",
      };
    }
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

/** Update courier reference while status is `shipped` (admin). */
export async function updateShippedTrackingOnly(params: {
  shopOrderId: string;
  trackingNumber: string | null;
  actor: AdvanceShopOrderActor;
  vendorId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { shopOrderId, trackingNumber, actor, vendorId } = params;
  const row = await prisma.vendorShopOrder.findUnique({
    where: { id: shopOrderId },
  });
  if (!row) {
    return { ok: false, error: "Not found" };
  }
  if (actor === "vendor") {
    if (!vendorId || row.vendorId !== vendorId) {
      return { ok: false, error: "Not found" };
    }
    return {
      ok: false,
      error: "Tracking updates after shipping are done by the admin.",
    };
  }
  if (row.status !== "shipped") {
    return {
      ok: false,
      error: "Tracking can only be edited while status is shipped",
    };
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
