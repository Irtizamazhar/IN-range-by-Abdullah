import { z } from "zod";
import { normalizePakistanMobile, PAKISTAN_MOBILE_ERROR } from "@/lib/pakistan-phone";
import { sanitizePlainText } from "@/lib/security/sanitize";

export const customerRegistrationInput = z.object({
  name: z.string().trim().min(1).max(200).transform(v => sanitizePlainText(v, 200)).pipe(z.string().min(1)),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(6).max(72).refine(v => Buffer.byteLength(v, "utf8") <= 72, "Password must be at most 72 bytes."),
  phone: z.string().trim().max(30).optional().default("")
    .refine(v => !v || Boolean(normalizePakistanMobile(v)), PAKISTAN_MOBILE_ERROR)
    .transform(v => v ? normalizePakistanMobile(v) || "" : ""),
});
