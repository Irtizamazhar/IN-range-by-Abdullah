import type { ShopOrderJson } from "@/lib/vendor-shop-order-helpers";

/** Row shape returned by vendor + admin shop-order list APIs. */
export type ShopOrderListRow = ShopOrderJson & {
  itemCount: number;
  paymentMethodLabel: string;
};
