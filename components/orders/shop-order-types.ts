import type { ShopOrderJson, VendorShopOrderView } from "@/lib/vendor-shop-order-helpers";

/** Customer and seller details: present in admin responses, never in seller responses. */
export type ShopOrderPrivateDetails = Partial<
  Pick<ShopOrderJson, "customerId" | "customerName" | "customerPhone" | "customerEmail" | "customerAddress" | "vendor">
>;

/** Row shape returned by vendor + admin shop-order list APIs. */
export type ShopOrderListRow = VendorShopOrderView & ShopOrderPrivateDetails & {
  itemCount: number;
  paymentMethodLabel: string;
};
