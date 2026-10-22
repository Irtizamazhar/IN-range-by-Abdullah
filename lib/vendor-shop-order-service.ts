import { Prisma, type VendorShopOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  appendStatusHistory,
  nextShopStatus,
  syncLineOrdersToShopStatus,
} from "@/lib/vendor-shop-order-helpers";
import { cancelSellerOrder } from "@/lib/order-cancellation-service";
import { consumeReservedInventory } from "@/lib/order-inventory-service";
import { writeAdminAudit } from "@/lib/admin-rbac";
import { ApiError } from "@/lib/marketplace-api";

export type AdvanceShopOrderActor = "vendor" | "admin";

/**
 * Advance shop order one step. Vendors: only through `packed`. Admin can
 * complete `shipped`→`delivered`; pickup handover performs `packed`→`shipped`.
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
    if (row.status === "packed" && next === "shipped") {
      return { ok: false, error: "Record courier handover in Pickup Management before marking this order shipped." };
    }
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
    const gate = await tx.vendorShopOrder.updateMany({
      where: { id: shopOrderId, status: row.status },
      data,
    });
    if (gate.count !== 1) {
      throw new Error("Order status changed; refresh and try again");
    }
    await syncLineOrdersToShopStatus(
      tx,
      shopOrderId,
      next,
      next === "shipped" ? trackingNumber : undefined
    );
    if (next === "delivered") {
      await consumeReservedInventory(tx, { vendorShopOrderId: shopOrderId });
      if (row.paymentMethod === "cod") {
        await tx.vendorShopOrder.update({
          where: { id: shopOrderId },
          data: { paymentStatus: "received" },
        });
      }
    }
  });

  return { ok: true, newStatus: next };
}

/** Update courier reference while status is `shipped` (admin). */
export async function updateShippedTrackingOnly(params: {
  shopOrderId: string;
  trackingNumber: string | null;
  actor: AdvanceShopOrderActor;
  vendorId?: string;
  adminId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { shopOrderId, trackingNumber, actor, vendorId, adminId } = params;
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
  if (!adminId) return { ok: false, error: "Admin identity is required" };
  if (trackingNumber !== null && (!trackingNumber.trim() || trackingNumber.trim().length > 255)) {
    return { ok: false, error: "Provide a tracking number of 1 to 255 characters" };
  }
  const tn =
    trackingNumber === null || trackingNumber === ""
      ? null
      : trackingNumber.trim();

  await prisma.$transaction(async (tx) => {
    const pickup = await tx.pickupRequest.findUnique({ where: { shopOrderId } });
    if (pickup && (pickup.status !== "handed_over" || !tn)) {
      throw new ApiError(409, "A handed-over parcel must keep a valid tracking number");
    }
    const gate = await tx.vendorShopOrder.updateMany({
      where: { id: shopOrderId, status: "shipped", updatedAt: row.updatedAt },
      data: { trackingNumber: tn },
    });
    if (gate.count !== 1) throw new ApiError(409, "Order changed; refresh and try again");
    if (pickup) {
      const changed = await tx.pickupRequest.updateMany({
        where: { id: pickup.id, status: "handed_over", updatedAt: pickup.updatedAt },
        data: { trackingNumber: tn, history: [...(Array.isArray(pickup.history) ? pickup.history : []), { status: "handed_over", at: new Date().toISOString(), actor: adminId, note: `Tracking corrected from ${pickup.trackingNumber || "unset"} to ${tn}` }] as Prisma.InputJsonValue },
      });
      if (changed.count !== 1) throw new ApiError(409, "Pickup changed; refresh and try again");
    }
    await tx.vendorOrder.updateMany({
      where: { vendorShopOrderId: shopOrderId },
      data: { trackingNumber: tn },
    });
    await writeAdminAudit(tx, { adminId, action: "pickup.tracking.corrected", entityType: "VendorShopOrder", entityId: shopOrderId, details: { previous: row.trackingNumber, current: tn, pickupRequestId: pickup?.id ?? null } });
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
  const result = await cancelSellerOrder({
    shopOrderId: params.shopOrderId,
    reason: params.reason,
    vendorId: params.vendorId,
    actorType: params.vendorId ? "vendor" : "admin",
    actorId: params.vendorId ?? "admin",
  });
  return result.ok ? { ok: true } : result;
}
