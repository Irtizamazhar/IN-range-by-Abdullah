/** Read recorded amounts for invoices and receipts; never reprice a historical order. */
export function storedOrderBreakdown(order: {
  totalAmount: unknown;
  handlingFee?: unknown;
  orderItems: { price: unknown; quantity: number }[];
  services?: { price: unknown; quantity: number }[];
  couponRedemption?: { discount: unknown } | null;
}) {
  const productSubtotal = order.orderItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const serviceSubtotal = (order.services ?? []).reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const discount = Number(order.couponRedemption?.discount ?? 0);
  const handlingFee = Number(order.handlingFee ?? 0);
  const total = Number(order.totalAmount);
  const delivery = Math.round((total - productSubtotal - serviceSubtotal + discount - handlingFee) * 100) / 100;
  return { productSubtotal, serviceSubtotal, discount, handlingFee, delivery, total };
}
