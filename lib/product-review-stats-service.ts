import { prisma } from "@/lib/prisma";
import { ORDER_INCLUDE_REVIEW } from "@/lib/prisma-order-includes";
import { isOrderDeliveredForReview, orderEmailsMatch, orderHasProductLine } from "@/lib/order-review-eligibility";
/** Only purchase-backed approved reviews contribute to marketplace trust. Deduplicate legacy rows without deleting history. */
export async function productReviewStatsService(productIds: string[]) {
  const rows = await prisma.review.findMany({
    where: { productId: { in: productIds }, approved: true, withdrawn: false, customerId: { not: null }, orderId: { not: null } },
    include: { customer: { select: { email: true } }, order: { include: ORDER_INCLUDE_REVIEW } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const seen = new Set<string>();
  return rows.filter(r => {
    if (!r.customer || !r.order || !isOrderDeliveredForReview(r.order) || !orderEmailsMatch(r.order.customerEmail, r.customer.email) || !orderHasProductLine(r.order, r.productId)) return false;
    const key = `${r.customerId}:${r.productId}`; if (seen.has(key)) return false; seen.add(key); return true;
  }).map(r => ({ id: r.id, productId: r.productId, name: r.name, rating: r.rating, comment: r.comment, imageUrl: r.imageUrl, createdAt: r.createdAt, verifiedPurchase: true as const }));
}