import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";

/** Resolve non-stock lines from committed order evidence, never from the client or a mutable catalog. */
export async function resolveOrderLineSeller(tx: Prisma.TransactionClient, orderItemId: string) {
  const review = () => new ApiError(409, "Seller attribution needs administrative review. Reconcile this order line before approving a return or refund.");
  const item = await tx.orderItem.findUnique({ where: { id: orderItemId }, include: { order: { include: { orderItems: { select: { id: true } }, statusEvents: { where: { eventType: "order_created" }, select: { details: true } }, offerQuote: { include: { want: { select: { requestType: true } }, revision: { include: { offer: { select: { vendorId: true } } } } } } } } } });
  if (!item) throw review();
  type Evidence = { orderItemId: string; vendorId: string | null; vendorShopOrderId: string | null; vendorOrderId: string | null };
  const evidence = item.order.statusEvents.flatMap(event => {
    const details = event.details as { lineSellers?: Evidence[] } | null;
    return Array.isArray(details?.lineSellers) ? details.lineSellers.filter(line => line.orderItemId === item.id) : [];
  });
  if (evidence.length > 1) throw review();
  const saved = evidence[0];
  if (saved && saved.vendorId === null && saved.vendorShopOrderId === null && saved.vendorOrderId === null) return null;
  let sellerId = saved?.vendorId;
  // Legacy quote-only gifts have an unambiguous seller only when the order has exactly one item.
  const quote = item.order.offerQuote;
  if (!saved) {
    if (item.order.orderItems.length !== 1 || quote?.want.requestType !== "GIFT") throw review();
    sellerId = quote.revision.offer.vendorId;
  }
  if (!sellerId) throw review();
  const lines = await tx.vendorOrder.findMany({ where: { orderId: item.orderId, vendorId: sellerId, ...(saved?.vendorOrderId ? { id: saved.vendorOrderId } : {}) }, take: 2 });
  if (lines.length !== 1) throw review();
  const line = lines[0];
  if (!line.vendorShopOrderId || (saved && (saved.vendorShopOrderId !== line.vendorShopOrderId || saved.vendorOrderId !== line.id)) || line.quantity !== item.quantity || !line.saleAmount.equals(item.price.mul(item.quantity))) throw review();
  const shop = await tx.vendorShopOrder.findFirst({ where: { id: line.vendorShopOrderId, orderId: item.orderId, vendorId: sellerId }, select: { id: true, vendorId: true, status: true } });
  if (!shop) throw review();
  return { vendorId: sellerId, vendorShopOrderId: shop.id, vendorOrderId: line.id, status: shop.status, saleAmount: line.saleAmount, vendorAmount: line.vendorAmount };
}
