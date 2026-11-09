import { z } from "zod";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { optionalPakistanMobileSchema, pakistanMobileSchema } from "@/lib/pakistan-phone-schema";
import { personNameSchema } from "@/lib/validation/schemas";
const text = (min: number, max: number) => z.string().max(max).transform(v => sanitizePlainText(v, max)).pipe(z.string().min(min).max(max));
export const addressSchema = z.object({
  label: text(1,60), recipientName: personNameSchema("Recipient name"), phone: pakistanMobileSchema,
  address: text(5,2000), city: text(1,120), postalCode: text(0,30).optional().nullable(), isDefault: z.boolean().optional(),
});
export const profileSchema = z.object({ name: personNameSchema("Name"), phone: optionalPakistanMobileSchema });
