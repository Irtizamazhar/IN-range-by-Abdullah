import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";
import { validateOfferProduct } from "@/lib/offer-service";
export async function checkoutQuote(tx: Prisma.TransactionClient, quoteId: string, customerId: string, city: string) {
  const quote = await tx.offerQuote.findFirst({ where: { id: quoteId, customerId }, include: { revision: { include: { offer: { select: { status: true, vendorId: true } } } }, want: { select: { status: true, expiresAt: true, city: true } } } });
  if (!quote) throw new ApiError(404, "Quote not found.");
  if (quote.orderId) return quote;
  if (quote.expiresAt <= new Date() || quote.want.expiresAt <= new Date() || quote.want.status !== "OPEN" || quote.revision.offer.status !== "ACCEPTED") throw new ApiError(409, "Accepted quote has expired or is no longer available.");
  if (city.trim().toLowerCase() !== quote.want.city.trim().toLowerCase()) throw new ApiError(400, "Delivery city must match the accepted offer.");
  await validateOfferProduct(tx, quote.revision.offer.vendorId, quote.revision.productId, quote.revision.quantity);
  return quote;
}