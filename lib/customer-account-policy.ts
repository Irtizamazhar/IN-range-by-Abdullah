/** Only root-relative, same-site destinations may be rendered from notification records. */
export function safeAccountLink(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u0020]/.test(decoded)) return null;
    const url = new URL(value, "https://account.invalid");
    return url.origin === "https://account.invalid" ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch { return null; }
}
/**
 * Customers may cancel only until the order is confirmed: every seller part is still pending
 * (not yet confirmed by the seller) and JORO has not started processing its own items.
 * Checkout creates the parent order as "confirmed", so that parent status still counts as placed.
 */
export const CUSTOMER_CANCEL_BLOCKED_MESSAGE =
  "This order has already been confirmed by the seller, so it can no longer be cancelled. Please contact support if you need help.";

export function canCustomerCancelOrder(order: { orderStatus: string; paymentStatus: string; vendorShopOrders: { status: string }[] }): boolean {
  return ["pending", "confirmed"].includes(order.orderStatus)
    && !["received", "partially_refunded", "refunded"].includes(order.paymentStatus)
    && order.vendorShopOrders.every(s => s.status === "pending" || s.status === "cancelled");
}