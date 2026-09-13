export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export const PAYMENT_STATUSES = [
  "pending",
  "submitted",
  "received",
  "failed",
  "rejected",
  "partially_refunded",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const fulfilmentRank: Record<Exclude<OrderStatus, "cancelled">, number> = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  packed: 3,
  shipped: 4,
  delivered: 5,
};

const paymentTransitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ["submitted", "received", "failed"],
  submitted: ["received", "rejected", "failed"],
  received: ["partially_refunded", "refunded"],
  failed: ["pending"],
  rejected: ["pending", "submitted"],
  partially_refunded: ["refunded"],
  refunded: [],
};

export function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus);
}

/** Fulfilment can move forward (including skipped admin milestones), never back. */
export function canTransitionOrderStatus(from: string, to: string): boolean {
  if (!isOrderStatus(from) || !isOrderStatus(to)) return false;
  if (from === to) return true;
  if (from === "delivered" || from === "cancelled") return false;
  if (to === "cancelled") return fulfilmentRank[from] < fulfilmentRank.shipped;
  return fulfilmentRank[to] > fulfilmentRank[from];
}

export function canTransitionPaymentStatus(from: string, to: string): boolean {
  if (from === to) return isPaymentStatus(to);
  if (!isPaymentStatus(from) || !isPaymentStatus(to)) return false;
  return paymentTransitions[from].includes(to);
}
