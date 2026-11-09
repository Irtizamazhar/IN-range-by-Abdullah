/** Upper bound shared by the vendor and admin catalog APIs (DECIMAL(12,2) column). */
export const MAX_PRODUCT_PRICE = 99_999_999;

export const PRICE_ERROR = "Sale price must be a number greater than zero.";
export const ORIGINAL_PRICE_ERROR = "Original price must be a number greater than zero, or left empty.";
export const ORIGINAL_BELOW_SALE_ERROR = "Original price must be equal to or higher than the sale price.";

/**
 * Pricing rules for every catalog write:
 * sale price > 0; original price (optional) > 0 and >= sale price. Equal prices are allowed and simply
 * show no discount. Returns the first problem as a user-facing message, or null.
 */
export function productPricingError(price: unknown, originalPrice?: unknown): string | null {
  const sale = typeof price === "number" ? price : Number.NaN;
  if (!Number.isFinite(sale) || sale <= 0 || sale > MAX_PRODUCT_PRICE) return PRICE_ERROR;
  if (originalPrice === null || originalPrice === undefined) return null;
  const original = typeof originalPrice === "number" ? originalPrice : Number.NaN;
  if (!Number.isFinite(original) || original <= 0 || original > MAX_PRODUCT_PRICE) return ORIGINAL_PRICE_ERROR;
  if (original < sale) return ORIGINAL_BELOW_SALE_ERROR;
  return null;
}
