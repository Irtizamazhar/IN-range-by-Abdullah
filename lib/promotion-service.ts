import { z } from "zod";
import { safeAccountLink } from "@/lib/customer-account-policy";

export const PROMOTION_PLACEMENTS = ["HOMEPAGE_SPOTLIGHT", "HOMEPAGE_BANNER", "FEATURED_VENDOR_CARD"] as const;
export const PROMOTION_PLACEMENT_LABELS: Record<(typeof PROMOTION_PLACEMENTS)[number], string> = {
  HOMEPAGE_SPOTLIGHT: "Homepage Vendor Spotlight",
  HOMEPAGE_BANNER: "Homepage Promotional Banner",
  FEATURED_VENDOR_CARD: "Featured Vendor Card",
};
export const PROMOTION_STATUSES = ["DRAFT", "ACTIVE", "DISABLED", "ARCHIVED"] as const;

const media = z.string().trim().max(2048).refine(
  v => !v || (v.startsWith("/uploads/") && !v.includes("..")) || /^https:\/\//.test(v),
  "Image must be an uploaded file or an https:// URL."
);

/** A blank/omitted destination defers to the vendor's canonical /stores/[slug]. */
const ctaHref = z.string().trim().max(2048).optional().nullable().transform(v => (v ? v : null)).refine(
  v => v === null || safeAccountLink(v) !== null,
  "CTA destination must be a safe root-relative internal path."
);

export const promotionInput = z.object({
  id: z.string().optional(),
  vendorId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(300).optional().default(""),
  desktopImage: media.optional().default(""),
  mobileImage: media.optional().default(""),
  ctaText: z.string().trim().min(1).max(60),
  ctaHref,
  placement: z.enum(PROMOTION_PLACEMENTS),
  priority: z.number().int().min(0).max(1000),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional().nullable(),
  status: z.enum(PROMOTION_STATUSES),
  isSponsored: z.boolean(),
  reason: z.string().trim().min(3).max(2000),
}).refine(v => !v.endAt || new Date(v.endAt) > new Date(v.startAt), { message: "End date must be after the start date.", path: ["endAt"] });
