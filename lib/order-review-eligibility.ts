import type { OrderWithReviewRelations } from "@/lib/prisma-order-includes";

export type OrderForReviewCheck = OrderWithReviewRelations;

/** Review ownership must come from the immutable account relation, never an email supplied at checkout. */
export function customerOwnsReviewOrder(
  orderCustomerId: string | null,
  customerId: string
): boolean {
  return Boolean(orderCustomerId && orderCustomerId === customerId);
}

/**
 * A marketplace line is eligible when its own seller slice is delivered. A
 * first-party/legacy line without a seller slice follows the parent order.
 */
export function isOrderProductDeliveredForReview(
  order: OrderForReviewCheck,
  productId: string
): boolean {
  const matchingLines = order.orderItems.filter(
    (item) => item.productId === productId
  );
  if (!matchingLines.length) return false;

  return matchingLines.some((item) => {
    const shopOrder = item.inventoryLine?.vendorShopOrder;
    if (shopOrder) return shopOrder.status.toLowerCase() === "delivered";
    return order.orderStatus.toLowerCase() === "delivered";
  });
}

export function isReviewOrderEligible(
  order: OrderForReviewCheck,
  customerId: string,
  productId: string
): boolean {
  return (
    customerOwnsReviewOrder(order.customerId, customerId) &&
    isOrderProductDeliveredForReview(order, productId)
  );
}
