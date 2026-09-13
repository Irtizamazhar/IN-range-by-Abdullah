import { z } from "zod";
export const wantInput = z.object({
  title: z.string().trim().min(3).max(160), category: z.string().trim().min(1).max(100), city: z.string().trim().min(1).max(100),
  budgetFlexible: z.boolean(), budgetMin: z.number().min(0).max(9999999999).nullable(), budgetMax: z.number().positive().max(9999999999).nullable(),
  quantity: z.number().int().min(1).max(10000), description: z.string().trim().max(5000).optional(),
  condition: z.enum(["Any", "New", "Used", "Refurbished"]).optional(),
  photo: z.string().trim().max(2048).optional().nullable().refine(v => !v || v.startsWith("/uploads/wants/"), "Invalid photo."),
  expiresAt: z.string().datetime().optional(), needBy: z.string().datetime().nullable().optional(),
  draft: z.boolean().optional(),
})
  .refine(v => v.budgetFlexible || (v.budgetMax !== null && (v.budgetMin ?? 0) <= v.budgetMax), { message: "Please provide a valid budget range.", path: ["budgetMax"] })
  .refine(v => !v.needBy || new Date(v.needBy).getTime() > Date.now(), { message: "Need-by date must be in the future.", path: ["needBy"] })
  .refine(v => !v.needBy || !v.expiresAt || new Date(v.needBy).getTime() <= new Date(v.expiresAt).getTime(), { message: "Need-by date must be before the Want expires.", path: ["needBy"] });
