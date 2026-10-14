import { z } from "zod";
import { ApiError } from "@/lib/marketplace-api";

const ids = z.array(z.string().min(1)).max(100).default([]);
export const couponInput = z.object({
  id: z.string().optional(),
  couponCode: z.string().trim().min(4).max(32).optional(),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().positive().max(1000000),
  minOrderAmount: z.coerce.number().min(0).max(100000000).default(0),
  maxDiscount: z.coerce.number().positive().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  productIds: ids,
  categories: ids,
  collectionIds: ids,
  selectedVendorIds: ids,
  customerIds: ids,
  maxUses: z.coerce.number().int().positive().nullable().optional(),
  perCustomerLimit: z.coerce.number().int().positive().nullable().optional(),
  fundingType: z.enum(["PLATFORM_FUNDED", "VENDOR_FUNDED"]).default("VENDOR_FUNDED"),
  budget: z.coerce.number().positive().nullable().optional(),
}).refine(v => v.discountType !== "percent" || v.discountValue <= 100, "Percent cannot exceed 100.")
  .refine(v => !v.startDate || !v.expiryDate || new Date(v.startDate) < new Date(v.expiryDate), "Expiry must follow start date.");

export function couponCodeOrRandom(value?: string) {
  const code = value?.trim().toUpperCase() || `JORO${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  if (!/^[A-Z0-9_-]{4,32}$/.test(code)) throw new ApiError(400, "Enter a valid coupon code.");
  return code;
}
