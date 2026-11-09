import { z } from "zod";
import { normalizePakistanMobile, PAKISTAN_MOBILE_ERROR } from "@/lib/pakistan-phone";
import { personNameSchema } from "@/lib/validation/schemas";

export const customerRegistrationInput = z.object({
  name: personNameSchema("Full name"),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(6).max(72).refine(v => Buffer.byteLength(v, "utf8") <= 72, "Password must be at most 72 bytes."),
  phone: z.string().trim().max(30).optional().default("")
    .refine(v => !v || Boolean(normalizePakistanMobile(v)), PAKISTAN_MOBILE_ERROR)
    .transform(v => v ? normalizePakistanMobile(v) || "" : ""),
});
