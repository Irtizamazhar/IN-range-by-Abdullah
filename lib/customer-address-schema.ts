import { z } from "zod";
import { sanitizePlainText } from "@/lib/security/sanitize";
const text = (min: number, max: number) => z.string().max(max).transform(v => sanitizePlainText(v, max)).pipe(z.string().min(min).max(max));
export const addressSchema = z.object({
  label: text(1,60), recipientName: text(1,200), phone: text(7,40).refine(v => /^[+\d() .-]+$/.test(v), "Invalid phone"),
  address: text(5,2000), city: text(1,120), postalCode: text(0,30).optional().nullable(), isDefault: z.boolean().optional(),
});
export const profileSchema = z.object({ name: text(1,200), phone: text(0,40).refine(v => !v || /^[+\d() .-]{7,40}$/.test(v), "Invalid phone") });