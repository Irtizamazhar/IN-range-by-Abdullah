import type { Prisma, VendorShopOrder, VendorShopOrderStatus } from "@prisma/client";

/** One entry in `VendorShopOrder.statusHistory` JSON. */
export type ShopStatusHistoryEntry = {
  status: VendorShopOrderStatus;
  updatedAt: string;
  note: string;
};

/** Ordered fulfillment steps (excluding cancelled). */
export const SHOP_STATUS_FLOW: VendorShopOrderStatus[] = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
];

/** Next status in the linear flow, or null if terminal / cancelled. */
export function nextShopStatus(
  current: VendorShopOrderStatus
): VendorShopOrderStatus | null {
  if (current === "cancelled" || current === "delivered") return null;
  const i = SHOP_STATUS_FLOW.indexOf(current);
  if (i < 0 || i >= SHOP_STATUS_FLOW.length - 1) return null;
  return SHOP_STATUS_FLOW[i + 1]!;
}

/** Keep legacy `VendorOrder.status` aligned for reporting / old integrations. */
export function mapShopStatusToLineStatus(
  s: VendorShopOrderStatus
): "pending" | "processing" | "shipped" | "delivered" | "cancelled" {
  switch (s) {
    case "pending":
      return "pending";
    case "confirmed":
    case "packed":
      return "processing";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

export function parseStatusHistory(raw: unknown): ShopStatusHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is ShopStatusHistoryEntry =>
      x != null &&
      typeof x === "object" &&
      "status" in x &&
      "updatedAt" in x &&
      typeof (x as ShopStatusHistoryEntry).updatedAt === "string"
  ) as ShopStatusHistoryEntry[];
}

export function appendStatusHistory(
  current: unknown,
  entry: ShopStatusHistoryEntry
): ShopStatusHistoryEntry[] {
  return [...parseStatusHistory(current), entry];
}

/** Apply shop status + optional tracking to all line rows in the bundle. */
export async function syncLineOrdersToShopStatus(
  tx: Prisma.TransactionClient,
  vendorShopOrderId: string,
  status: VendorShopOrderStatus,
  trackingNumber: string | null | undefined
): Promise<void> {
  const lineStatus = mapShopStatusToLineStatus(status);
  const data: {
    status: typeof lineStatus;
    trackingNumber?: string | null;
  } = { status: lineStatus };
  if (trackingNumber !== undefined) {
    data.trackingNumber =
      trackingNumber === "" || trackingNumber == null ? null : trackingNumber;
  }
  await tx.vendorOrder.updateMany({
    where: { vendorShopOrderId },
    data,
  });
}

export type ShopOrderJson = {
  id: string;
  shopOrderNumber: string;
  parentOrderNumber: string;
  parentOrderId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  city: string;
  items: Array<{
    productId: string | null;
    productName: string;
    quantity: number;
    price: number;
    subtotal: number;
    vendorProductId?: string | null;
    variant?: string | null;
  }>;
  totalAmount: string;
  commissionAmount: string;
  netAmount: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: VendorShopOrderStatus;
  statusHistory: ShopStatusHistoryEntry[];
  cancelReason: string | null;
  trackingNumber: string | null;
  placedAt: string;
  updatedAt: string;
  vendor?: {
    id: string;
    shopName: string;
    ownerName: string;
    email: string;
    phone: string;
    city: string;
  };
};

function normalizeItems(raw: unknown): ShopOrderJson["items"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const o = row as Record<string, unknown>;
    return {
      productId:
        o.productId != null && o.productId !== ""
          ? String(o.productId)
          : null,
      productName: String(o.productName ?? "Item"),
      quantity: Math.max(0, Number(o.quantity) || 0),
      price: Number(o.price) || 0,
      subtotal: Number(o.subtotal) || 0,
      vendorProductId:
        o.vendorProductId != null ? String(o.vendorProductId) : null,
      variant: o.variant != null ? String(o.variant) : null,
    };
  });
}

export function serializeVendorShopOrder(
  row: VendorShopOrder & {
    order?: { orderNumber: string };
    vendor?: {
      id: string;
      shopName: string;
      ownerName: string;
      email: string;
      phone: string;
      city: string;
    };
  }
): ShopOrderJson {
  return {
    id: row.id,
    shopOrderNumber: row.shopOrderNumber,
    parentOrderNumber: row.order?.orderNumber ?? "",
    parentOrderId: row.orderId,
    customerId: row.customerId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    customerAddress: row.customerAddress,
    city: row.city,
    items: normalizeItems(row.items),
    totalAmount: row.totalAmount.toString(),
    commissionAmount: row.commissionAmount.toString(),
    netAmount: row.netAmount.toString(),
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    orderStatus: row.status,
    statusHistory: parseStatusHistory(row.statusHistory),
    cancelReason: row.cancelReason,
    trackingNumber: row.trackingNumber,
    placedAt: row.placedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    vendor: row.vendor,
  };
}

/** Friendly payment label for tables. */
export function paymentMethodLabel(method: string): string {
  if (method === "cod") return "COD";
  if (method === "bank_transfer") return "Online";
  return method;
}

/** Tab counts for vendor shop-order list (keys: all + each VendorShopOrderStatus). */
export function buildShopOrderStatusCounts(
  groups: Array<{ status: VendorShopOrderStatus; _count: { _all: number } }>
): Record<string, number> {
  const counts: Record<string, number> = {
    all: 0,
    pending: 0,
    confirmed: 0,
    packed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const g of groups) {
    const n = g._count._all;
    if (g.status in counts) counts[g.status] = n;
    counts.all += n;
  }
  return counts;
}
