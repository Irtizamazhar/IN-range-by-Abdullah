import type { OrderWithReviewRelations } from "@/lib/prisma-order-includes";
import { resolveCustomerOrderTrackStatus } from "@/lib/order-track-status";

export type OrderForReviewCheck = OrderWithReviewRelations;

export function orderEmailsMatch(
  orderEmail: string,
  customerEmail: string
): boolean {
  return orderEmail.trim().toLowerCase() === customerEmail.trim().toLowerCase();
}

export function isOrderDeliveredForReview(order: OrderForReviewCheck): boolean {
  const effective = resolveCustomerOrderTrackStatus(
    order.orderStatus,
    order.vendorShopOrders
  );
  return effective === "delivered";
}

export function orderHasProductLine(
  order: OrderForReviewCheck,
  productId: string
): boolean {
  return order.orderItems.some((i) => i.productId === productId);
}
