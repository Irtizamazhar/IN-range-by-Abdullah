import { z } from "zod";

export const wantPostSchema = z
  .object({
    title: z.string().min(5).max(200),
    description: z.string().min(10).max(3000),
    category: z.string().min(1).max(120),
    city: z.string().min(1).max(120),
    budgetMin: z.number().positive().max(100_000_000).optional().nullable(),
    budgetMax: z.number().positive().max(100_000_000).optional().nullable(),
    quantity: z.number().int().min(1).max(100).default(1),
    condition: z.enum(["new", "used", "either"]).optional().nullable(),
  })
  .refine(
    (value) =>
      value.budgetMin == null ||
      value.budgetMax == null ||
      value.budgetMax >= value.budgetMin,
    { message: "Maximum budget must be at least the minimum budget", path: ["budgetMax"] }
  );

export const wantOfferSchema = z.object({
  amount: z.number().positive().max(100_000_000),
  message: z.string().min(10).max(2000),
  estimatedDays: z.number().int().min(1).max(365).optional().nullable(),
});
