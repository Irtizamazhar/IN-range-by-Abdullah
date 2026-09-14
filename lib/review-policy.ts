import { z } from "zod";
import { sanitizePlainText } from "@/lib/security/sanitize";

export const REVIEW_COMMENT_MAX_LENGTH = 5_000;
export const REVIEW_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const dangerousReviewContent =
  /<\s*\/?\s*(script|style|iframe|object|embed|svg|math|link|meta)\b|javascript\s*:|on[a-z]+\s*=/i;

export function hasDangerousReviewContent(value: string): boolean {
  return dangerousReviewContent.test(value) || value.includes("\0");
}

export function sanitizeReviewComment(value: string): string {
  const sanitized = sanitizePlainText(value, REVIEW_COMMENT_MAX_LENGTH);
  // sanitize-html encodes ordinary punctuation because its output is normally
  // inserted as HTML. Reviews are rendered as React text, so decode one safe
  // entity layer to avoid changing customer text such as "quality & delivery".
  return sanitized.replace(
    /&(?:amp|lt|gt|quot|#39|#x27|#(\d+)|#x([0-9a-f]+));/gi,
    (entity, decimal: string | undefined, hex: string | undefined) => {
      const named: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'",
        "&#x27;": "'",
      };
      const direct = named[entity.toLowerCase()];
      if (direct !== undefined) return direct;
      const codePoint = decimal
        ? Number.parseInt(decimal, 10)
        : Number.parseInt(hex || "", 16);
      return Number.isSafeInteger(codePoint) &&
        codePoint > 0 &&
        codePoint <= 0x10ffff &&
        !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : "";
    }
  );
}

const rawReviewSubmissionSchema = z
  .object({
    productId: z.string().trim().min(1).max(191),
    orderId: z.string().trim().min(1).max(191),
    rating: z.number().int().min(1).max(5),
    comment: z
      .string()
      .trim()
      .min(1)
      .max(REVIEW_COMMENT_MAX_LENGTH)
      .refine((value) => !hasDangerousReviewContent(value), {
        message: "Review contains unsafe content.",
      }),
    imageUrl: z.string().trim().max(2048).nullable().optional(),
  })
  .strict();

export const reviewSubmissionSchema = rawReviewSubmissionSchema.transform(
  (value) => ({
    ...value,
    comment: sanitizeReviewComment(value.comment),
  })
).refine((value) => value.comment.length > 0, {
  message: "Review comment is required.",
  path: ["comment"],
});

export const reviewWithdrawalSchema = z
  .object({ productId: z.string().trim().min(1).max(191) })
  .strict();

export function reviewPhotoUrlForCustomer(
  value: string,
  customerId: string
): boolean {
  if (value.includes("..") || value.includes("?") || value.includes("#")) {
    return false;
  }
  const parts = value.split("/");
  return (
    parts.length === 5 &&
    parts[1] === "uploads" &&
    parts[2] === "reviews" &&
    parts[3] === customerId &&
    /^rev-[0-9]+-[a-f0-9-]{8,36}\.(?:jpg|png|webp)$/i.test(parts[4] || "")
  );
}

export function isPublicReviewPhotoUrl(value: string | null): boolean {
  if (!value || value.includes("..") || value.includes("?") || value.includes("#")) {
    return false;
  }
  return /^\/uploads\/reviews\/(?:[A-Za-z0-9_-]+\/)?rev-[0-9]+-[A-Za-z0-9-]+\.(?:jpg|png|webp)$/i.test(
    value
  );
}

export type ReviewPhotoExtension = "jpg" | "png" | "webp";

export function detectReviewPhotoExtension(
  bytes: Uint8Array,
  claimedMime: string
): ReviewPhotoExtension | null {
  const mime = claimedMime.toLowerCase();
  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  if ((mime === "image/jpeg" || mime === "image/jpg") && isJpeg) return "jpg";
  if (mime === "image/png" && isPng) return "png";
  if (mime === "image/webp" && isWebp) return "webp";
  return null;
}
