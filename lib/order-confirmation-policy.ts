export function orderConfirmationEligible(order: { orderStatus: string; paymentMethod: string; paymentStatus: string }): boolean {
  if (!["confirmed", "processing", "packed", "shipped", "delivered"].includes(order.orderStatus)) return false;
  if (order.paymentMethod === "cod") return ["pending", "received"].includes(order.paymentStatus);
  return order.paymentMethod === "bank_transfer" && order.paymentStatus === "received";
}

export function confirmationRetry(attempts: number, now = new Date()): Date {
  return new Date(now.getTime() + Math.min(60, 2 ** attempts) * 60_000);
}
