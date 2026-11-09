import { z } from "zod";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { MAX_PRODUCT_PRICE, PRICE_ERROR, productPricingError } from "@/lib/product-pricing";

const money = z.number({ error: "Enter a valid amount." }).finite().positive().max(MAX_PRODUCT_PRICE);
const stock = z.number({ error: "Enter a valid stock quantity." }).int("Stock must be a whole number.").min(0, "Stock cannot be negative.").max(9_999_999);
const warranty = z.union([z.number().int().min(0).max(120), z.null()]).transform(value => (value && value > 0 ? value : null));
const variants = z.array(z.string().max(100).transform(value => sanitizePlainText(value, 100)).pipe(z.string().min(1))).max(50);
const imageIds = z.array(z.string().min(1).max(100)).max(20);
const plain = (max: number) => z.string().max(max * 2).transform(value => sanitizePlainText(value, max)).pipe(z.string().min(1, "This field is required."));

const adminProductFields = {
  name: plain(200),
  description: z.string().max(20_000),
  price: money,
  originalPrice: z.union([money, z.null()]),
  category: plain(255),
  stock,
  warrantyMonths: warranty,
  variants,
  isActive: z.boolean(),
  imageIds,
};

/** Admin catalog create (POST /api/products). */
export const adminProductCreateSchema = z.object({
  ...adminProductFields,
  description: adminProductFields.description.optional().default(""),
  originalPrice: adminProductFields.originalPrice.optional().default(null),
  stock: stock.optional().default(0),
  warrantyMonths: warranty.optional().default(null),
  variants: variants.optional().default([]),
  isActive: z.boolean().optional().default(true),
  imageIds: imageIds.optional().default([]),
}).superRefine((input, ctx) => {
  const error = productPricingError(input.price, input.originalPrice);
  if (error) ctx.addIssue({ code: "custom", path: [error === PRICE_ERROR ? "price" : "originalPrice"], message: error });
});

/** Admin catalog update (PUT /api/products/[id]); the route re-checks pricing against stored values. */
export const adminProductUpdateSchema = z.object(adminProductFields).partial();

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message || "Please check the product details.";
}
