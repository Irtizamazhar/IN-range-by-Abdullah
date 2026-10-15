import { z } from "zod";
import { sanitizeDescriptionHtml, sanitizePlainText } from "@/lib/security/sanitize";

export const emailCampaignInput = z.object({
  id: z.string().cuid().optional(),
  subject: z.string().trim().min(1).max(200).transform(value => sanitizePlainText(value, 200)).pipe(z.string().min(1)),
  previewText: z.string().trim().max(240).default("").transform(value => sanitizePlainText(value, 240)),
  bodyHtml: z.string().trim().min(1).max(20000).transform(value => sanitizeDescriptionHtml(value, 20000)).pipe(z.string().min(1)),
  audience: z.enum(["CUSTOMERS", "VENDORS", "BOTH", "INDIVIDUAL"]),
  recipientIds: z.array(z.string().cuid()).max(500).default([]),
});
