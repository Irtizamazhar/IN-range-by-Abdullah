import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";
import { sanitizePlainText } from "@/lib/security/sanitize";
export const offerTerms = z.object({ productId: z.string().nullable(), price: z.number().positive().max(999999999), quantity: z.number().int().min(1).max(10000), shipping: z.number().min(0).max(9999999), delivery: z.string().trim().min(1).max(300), condition: z.string().trim().min(1).max(100), warranty: z.string().trim().max(1000), message: z.string().trim().max(5000), expiresAt: z.string().datetime() });
/** Strips HTML/script content from vendor- and customer-authored free text before it is persisted. */
export function sanitizeOfferTerms<T extends z.infer<typeof offerTerms>>(terms: T): T {
  return { ...terms, delivery: sanitizePlainText(terms.delivery, 300), condition: sanitizePlainText(terms.condition, 100), warranty: sanitizePlainText(terms.warranty, 1000), message: sanitizePlainText(terms.message, 5000) };
}
export async function validateOfferProduct(tx: Prisma.TransactionClient, vendorId: string, productId: string | null, quantity: number) {
  if (!productId) throw new ApiError(400, "Link an active catalog product before checkout.");
  const product = await tx.product.findFirst({ where: { id: productId, isActive: true, stock: { gte: quantity }, vendorPublication: { vendorId, status: "active", stock: { gte: quantity }, vendor: { status: "approved" } } }, select: { id: true, name: true, price: true, variants: true } });
  if (!product) throw new ApiError(409, "The product or vendor is unavailable, or stock has changed.");
  if (Array.isArray(product.variants) && product.variants.length) throw new ApiError(409, "Negotiated checkout for variant products is not available yet. Use normal product checkout.");
  return product;
}
export function validateOfferExpiry(expiresAt: Date) { if (expiresAt <= new Date() || expiresAt.getTime() > Date.now() + 30 * 86400000) throw new ApiError(400, "Offer expiry must be within 30 days."); }