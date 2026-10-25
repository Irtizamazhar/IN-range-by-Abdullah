import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";
import { validateOfferItem } from "@/lib/offer-service";
export async function checkoutQuote(tx: Prisma.TransactionClient, quoteId: string, customerId: string, city?: string) {
  const quote = await tx.offerQuote.findFirst({ where: { id: quoteId, customerId }, include: { revision: { include: { offer: { select: { status: true, vendorId: true, vendor: { select: { specialCommissionRate: true } } } } } }, want: { select: { status: true, expiresAt: true, city: true, requestType: true, title: true, category: true } } } });
  if (!quote) throw new ApiError(404, "Quote not found.");
  if (quote.orderId) return quote;
  if (quote.expiresAt <= new Date() || quote.revision.expiresAt <= new Date() || quote.want.expiresAt <= new Date() || quote.want.status !== "OPEN" || quote.revision.offer.status !== "ACCEPTED") throw new ApiError(409, "Accepted quote has expired or is no longer available.");
  if (city !== undefined && city.trim().toLowerCase() !== quote.want.city.trim().toLowerCase()) throw new ApiError(400, "Delivery city must match the accepted offer.");
  await validateOfferItem(tx, quote.revision.offer.vendorId, quote.revision.productId, quote.revision.quantity, quote.want.requestType);
  return quote;
}
