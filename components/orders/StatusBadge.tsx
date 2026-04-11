"use client";

/** Subset of Prisma `VendorShopOrderStatus` for client bundles (no @prisma import). */
export type ShopOrderStatusPill =
  | "pending"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

/** Color-coded pill for vendor shop-order lifecycle (Daraz-style). */
const STYLES: Record<ShopOrderStatusPill, string> = {
  pending: "bg-amber-100 text-amber-900 ring-amber-200",
  confirmed: "bg-blue-100 text-blue-800 ring-blue-200",
  packed: "bg-purple-100 text-purple-800 ring-purple-200",
  shipped: "bg-orange-100 text-orange-900 ring-orange-200",
  delivered: "bg-green-100 text-green-800 ring-green-200",
  cancelled: "bg-red-100 text-red-800 ring-red-200",
};

export function StatusBadge({ status }: { status: ShopOrderStatusPill }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
