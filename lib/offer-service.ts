import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";
import { sanitizePlainText } from "@/lib/security/sanitize";
export const offerTerms = z.object({ productId: z.string().nullable(), price: z.number().positive().max(999999999), quantity: z.number().int().min(1).max(10000), shipping: z.number().min(0).max(9999999), delivery: z.string().trim().max(300), condition: z.string().trim().min(1).max(100), warranty: z.string().trim().max(1000), message: z.string().trim().max(5000), expiresAt: z.string().datetime() });
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
/**
 * What a vendor may send when first quoting on a Want. The customer already chose quantity and condition,
 * so those (plus the delivery charge) are set on the server; unknown keys are dropped by zod.
 */
export const newOfferInput = z.object({
  wantId: z.string({ message: "This Want could not be found." }).min(1, "This Want could not be found.").max(191),
  unitPrice: z.number({ message: "Enter a unit price." }).positive("Unit price must be at least PKR 1.").min(1, "Unit price must be at least PKR 1.").max(999999999),
  warranty: z.string().trim().max(1000).optional().default(""),
  message: z.string().trim().max(500, "Message can be at most 500 characters.").optional().default(""),
  /** Expected delivery or completion time, e.g. "2-3 days" (stored on the revision's delivery field). */
  delivery: z.string().trim().max(300, "Delivery estimate can be at most 300 characters.").optional().default(""),
  expiresAt: z.string().datetime().optional(),
  // Only sent when nothing in the vendor's catalog matches automatically and the vendor picks a product.
  productId: z.string().min(1).max(191).optional(),
});
export const DEFAULT_OFFER_DAYS = 7;

type OfferWant = { title: string; category: string; quantity: number };
const plain = (value: string) => value.replace(/&amp;/g, "&").trim().toLowerCase();

/** The vendor's products a customer could check out for this Want: active, enough stock, no variants. */
export async function offerableProducts(db: Prisma.TransactionClient, vendorId: string, quantity: number) {
  const rows = await db.product.findMany({
    where: { isActive: true, stock: { gte: quantity }, vendorPublication: { vendorId, status: "active", stock: { gte: quantity }, vendor: { status: "approved" } } },
    select: { id: true, name: true, category: true, price: true, variants: true }, orderBy: { name: "asc" }, take: 500,
  });
  return rows.filter(p => !(Array.isArray(p.variants) && p.variants.length));
}

/** Best automatic match by category and title words (ties: price closest to the quote), or null if none relates. */
export function matchOfferProduct<T extends { name: string; category: string; price: unknown }>(products: T[], want: OfferWant, unitPrice: number): T | null {
  const words = plain(want.title).split(/\W+/).filter(word => word.length > 2);
  const category = plain(want.category);
  const best = products
    .map(p => ({ p, score: (plain(p.category) === category ? 10 : 0) + words.filter(word => p.name.toLowerCase().includes(word)).length * 3 }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || Math.abs(Number(a.p.price) - unitPrice) - Math.abs(Number(b.p.price) - unitPrice))[0];
  return best ? best.p : null;
}

/**
 * Checkout builds the order from a catalog product, so every new offer is linked to one. The vendor's matching
 * product is chosen automatically (falling back to the one priced closest to the quote), unless the client sends one.
 */
export async function pickOfferProduct(tx: Prisma.TransactionClient, vendorId: string, want: OfferWant, unitPrice: number, chosenId?: string) {
  const products = await offerableProducts(tx, vendorId, want.quantity);
  if (!products.length) throw new ApiError(409, `You have no active product with at least ${want.quantity} in stock. Publish one in your catalog, then send your offer.`);
  if (chosenId) {
    const chosen = products.find(p => p.id === chosenId);
    if (!chosen) throw new ApiError(400, "Choose one of your active products with enough stock.");
    return chosen;
  }
  const match = matchOfferProduct(products, want, unitPrice);
  if (match) return match;
  // Nothing relates by category or title: link the product priced closest to the quote.
  return products.reduce((best, p) => (Math.abs(Number(p.price) - unitPrice) < Math.abs(Number(best.price) - unitPrice) ? p : best));
}
export function validateOfferExpiry(expiresAt: Date) { if (expiresAt <= new Date() || expiresAt.getTime() > Date.now() + 30 * 86400000) throw new ApiError(400, "Offer expiry must be within 30 days."); }