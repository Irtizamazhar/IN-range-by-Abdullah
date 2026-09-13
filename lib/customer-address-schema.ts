import { z } from "zod";

export const addressSchema = z.object({
  label: z.string().min(1).max(60),
  recipientName: z.string().min(1).max(200),
  phone: z.string().min(7).max(40),
  address: z.string().min(5).max(2000),
  city: z.string().min(1).max(120),
  postalCode: z.string().max(30).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});
