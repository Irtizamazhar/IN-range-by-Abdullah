import { z } from "zod";
import { ORIGINAL_BELOW_SALE_ERROR, PRICE_ERROR, productPricingError } from "@/lib/product-pricing";

export const vendorProductCreateSchema = z.object({
  productName: z.string().min(1).max(200),
  description: z.string().min(1).max(20_000),
  price: z.number().finite().positive().max(99_999_999),
  originalPrice: z.number().finite().positive().max(99_999_999).optional(),
  category: z.string().min(1).max(255),
  stock: z.number().int().min(0).max(9_999_999),
  warrantyMonths: z.number().int().min(1).max(120).nullable().optional(),
  images: z.array(z.string().min(1).max(500)).min(1).max(8),
}).superRefine((input, ctx) => {
  const error = productPricingError(input.price, input.originalPrice);
  if (error) ctx.addIssue({ code: "custom", path: [error === PRICE_ERROR ? "price" : "originalPrice"], message: error });
});

export const vendorProductUpdateSchema = z
  .object({
    productName: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(20_000).optional(),
    price: z.number().finite().positive().max(99_999_999).optional(),
    originalPrice: z
      .union([
        z.number().finite().positive().max(99_999_999),
        z.null(),
      ])
      .optional(),
    category: z.string().min(1).max(255).optional(),
    stock: z.number().int().min(0).max(9_999_999).optional(),
    warrantyMonths: z.number().int().min(1).max(120).nullable().optional(),
    images: z.array(z.string().min(1).max(500)).min(1).max(8).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field is required",
  })
  .superRefine((input, ctx) => {
    // When both prices arrive together they can be checked here; partial updates are checked
    // against the stored values in the route (see mergedPricingError).
    if (input.price !== undefined && input.originalPrice != null && input.originalPrice < input.price) {
      ctx.addIssue({ code: "custom", path: ["originalPrice"], message: ORIGINAL_BELOW_SALE_ERROR });
    }
  });

/** Re-check pricing after merging a partial update onto the stored product. */
export function mergedPricingError(
  stored: { price: unknown; originalPrice: unknown },
  update: { price?: number; originalPrice?: number | null }
): string | null {
  const price = update.price ?? Number(stored.price);
  const original = update.originalPrice !== undefined
    ? update.originalPrice
    : stored.originalPrice == null ? null : Number(stored.originalPrice);
  return productPricingError(price, original);
}

export function parseImagesJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}
