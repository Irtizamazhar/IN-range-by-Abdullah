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
export function canCustomerCancelOrder(order: { orderStatus: string; paymentStatus: string; vendorShopOrders: { status: string }[] }): boolean {
  const states = ["pending", "confirmed", "processing", "packed"];
  return states.includes(order.orderStatus) && !["received", "partially_refunded", "refunded"].includes(order.paymentStatus) && order.vendorShopOrders.every(s => states.includes(s.status));
}