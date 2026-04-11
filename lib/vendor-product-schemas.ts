import { z } from "zod";

export const vendorProductCreateSchema = z.object({
  productName: z.string().min(1).max(200),
  description: z.string().min(1).max(20_000),
  price: z.number().finite().positive().max(99_999_999),
  originalPrice: z.number().finite().positive().max(99_999_999).optional(),
  category: z.string().min(1).max(255),
  stock: z.number().int().min(0).max(9_999_999),
  images: z.array(z.string().min(1).max(500)).min(1).max(8),
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
    images: z.array(z.string().min(1).max(500)).min(1).max(8).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field is required",
  });

export function parseImagesJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}
