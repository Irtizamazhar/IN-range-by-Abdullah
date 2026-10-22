/**
 * Customer tracking timeline built only from recorded status changes:
 * parent `OrderStatusEvent` rows and marketplace `VendorShopOrder.statusHistory`.
 * Nothing is inferred beyond "a stage was reached at this time".
 */
export type TrackingStatus = "placed" | "confirmed" | "processing" | "packed" | "pickup_scheduled" | "collected" | "shipped" | "delivered" | "cancelled";
export type TrackingEvent = { status: TrackingStatus; at: string };

type ParentEvent = { eventType: string; toStatus: string | null; createdAt: Date };
type ShopSlice = { status: string; statusHistory: unknown; trackingNumber?: string | null; shopOrderNumber?: string; pickupRequest?: { status: string; history: unknown } | null };

const RANK: Record<Exclude<TrackingStatus, "cancelled">, number> = {
  placed: 0, confirmed: 1, processing: 2, packed: 3, pickup_scheduled: 4, collected: 5, shipped: 6, delivered: 7,
};

export function normalizeTrackingStatus(status: string | null | undefined): TrackingStatus | null {
  switch (String(status || "").toLowerCase()) {
    case "pending": return "placed";
    case "confirmed": return "confirmed";
    case "processing": return "processing";
    case "packed":
    case "packing": return "packed";
    case "shipped": return "shipped";
    case "delivered": return "delivered";
    case "cancelled": return "cancelled";
    default: return null;
  }
}

function historyEntries(raw: unknown): { status: TrackingStatus; at: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { status, updatedAt } = entry as { status?: unknown; updatedAt?: unknown };
    const normalized = normalizeTrackingStatus(typeof status === "string" ? status : null);
    const at = typeof updatedAt === "string" ? Date.parse(updatedAt) : NaN;
    return normalized && Number.isFinite(at) ? [{ status: normalized, at }] : [];
  });
}

export function buildOrderTrackingTimeline(input: {
  createdAt: Date;
  cancelledAt?: Date | null;
  orderStatus: string;
  events: ParentEvent[];
  shops: ShopSlice[];
}): TrackingEvent[] {
  const reached = new Map<TrackingStatus, number>();
  const record = (status: TrackingStatus, at: number) => {
    const prev = reached.get(status);
    if (prev === undefined || at < prev) reached.set(status, at);
  };

  record("placed", input.createdAt.getTime());
  const active = input.shops.filter((shop) => shop.status !== "cancelled");
  const sellerLimit = active.length ? Math.min(...active.map(shop => RANK[normalizeTrackingStatus(shop.status) as Exclude<TrackingStatus, "cancelled">] ?? 0)) : null;
  for (const event of input.events) {
    const at = event.createdAt.getTime();
    if (event.eventType === "order_cancelled") record("cancelled", at);
    if (event.eventType !== "order_created" && event.eventType !== "fulfilment_status_changed") continue;
    const status = normalizeTrackingStatus(event.toStatus);
    if (status && status !== "placed" && (sellerLimit === null || status === "cancelled" || RANK[status] <= sellerLimit)) record(status, at);
  }

  // A seller stage counts for the customer once every active seller reached it (slowest slice wins),
  // matching resolveCustomerOrderTrackStatus.
  if (active.length) {
    for (const stage of ["confirmed", "packed", "shipped", "delivered"] as const) {
      let latest = -Infinity;
      for (const shop of active) {
        const hits = historyEntries(shop.statusHistory)
          .filter((entry) => entry.status !== "cancelled" && RANK[entry.status] >= RANK[stage])
          .map((entry) => entry.at);
        if (!hits.length) { latest = NaN; break; }
        latest = Math.max(latest, Math.min(...hits));
      }
      if (Number.isFinite(latest)) record(stage, latest);
    }
    for (const [stage, pickupStatuses] of [["pickup_scheduled", ["scheduled", "assigned", "collected", "handed_over"]], ["collected", ["collected", "handed_over"]]] as const) {
      let latest = -Infinity;
      for (const shop of active) {
        const entries = Array.isArray(shop.pickupRequest?.history) ? shop.pickupRequest.history : [];
        const hits = entries.flatMap((entry: unknown) => {
          if (!entry || typeof entry !== "object") return [];
          const value = entry as { status?: unknown; at?: unknown };
          const at = typeof value.at === "string" ? Date.parse(value.at) : NaN;
          return typeof value.status === "string" && pickupStatuses.includes(value.status as never) && Number.isFinite(at) ? [at] : [];
        });
        if (!hits.length) { latest = NaN; break; }
        latest = Math.max(latest, Math.min(...hits));
      }
      if (Number.isFinite(latest)) record(stage, latest);
    }
  } else if (input.shops.length) {
    for (const shop of input.shops) for (const entry of historyEntries(shop.statusHistory)) if (entry.status === "cancelled") record("cancelled", entry.at);
  }

  if (normalizeTrackingStatus(input.orderStatus) === "cancelled" && !reached.has("cancelled") && input.cancelledAt) {
    record("cancelled", input.cancelledAt.getTime());
  }
  if (normalizeTrackingStatus(input.orderStatus) !== "cancelled") reached.delete("cancelled");

  return Array.from(reached.entries())
    .map(([status, at]) => ({ status, at: new Date(at).toISOString() }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** Tracking ID: the parent order's, else the single visible seller slice's. */
export function resolveTrackingNumber(orderTracking: string | null | undefined, shops: ShopSlice[]): string | null {
  const own = orderTracking?.trim();
  if (own) return own;
  const shopNumbers = Array.from(new Set(shops.map((shop) => shop.trackingNumber?.trim()).filter((value): value is string => Boolean(value))));
  return shopNumbers.length === 1 ? shopNumbers[0]! : null;
}
