/**
 * Homepage / track-order timeline uses these labels (see `app/(user)/track-order/page.tsx`).
 */
export const CUSTOMER_TRACK_STEPS = [
  "pending",
  "confirmed",
  "processing",
  "packing",
  "shipped",
  "delivered",
] as const;

export type CustomerTrackStep = (typeof CUSTOMER_TRACK_STEPS)[number];

export function customerTrackStepIndex(status: string): number {
  const s = status.toLowerCase();
  const i = CUSTOMER_TRACK_STEPS.indexOf(s as CustomerTrackStep);
  if (i >= 0) return i;
  if (s === "packed") return CUSTOMER_TRACK_STEPS.indexOf("packing");
  return 0;
}

/** Map vendor bundle lifecycle to customer timeline label. */
export function vendorShopStatusToTrackStep(status: string): CustomerTrackStep {
  switch (status) {
    case "pending":
      return "pending";
    case "confirmed":
      return "confirmed";
    case "packed":
      return "packing";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "pending";
    default:
      return "pending";
  }
}

/**
 * Public order status for tracking: merge parent `Order` with marketplace
 * `VendorShopOrder` rows so vendor fulfillment updates are visible to the customer.
 *
 * - One seller slice: max(parent, vendor) so vendor “delivered” wins over stale parent “pending”.
 * - Multiple sellers: max(parent, min(vendor)) so the slowest slice sets progress (no false “delivered”).
 */
export function resolveCustomerOrderTrackStatus(
  parentOrderStatus: string,
  vendorShopOrders: { status: string }[]
): string {
  if (parentOrderStatus.toLowerCase() === "cancelled") {
    return "cancelled";
  }

  const parentIdx = customerTrackStepIndex(parentOrderStatus);

  if (!vendorShopOrders.length) {
    return parentOrderStatus.toLowerCase();
  }

  const active = vendorShopOrders.filter((v) => v.status !== "cancelled");
  if (active.length === 0) {
    return "cancelled";
  }

  const vendorIdxs = active.map((v) =>
    customerTrackStepIndex(vendorShopStatusToTrackStep(v.status))
  );

  if (vendorShopOrders.length === 1) {
    const vMax = Math.max(...vendorIdxs);
    const combined = Math.max(parentIdx, vMax);
    return CUSTOMER_TRACK_STEPS[
      Math.min(combined, CUSTOMER_TRACK_STEPS.length - 1)
    ]!;
  }

  const vMin = Math.min(...vendorIdxs);
  const combined = Math.max(parentIdx, vMin);
  return CUSTOMER_TRACK_STEPS[
    Math.min(combined, CUSTOMER_TRACK_STEPS.length - 1)
  ]!;
}
