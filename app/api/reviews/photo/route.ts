export const dynamic = "force-dynamic";

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { ORDER_INCLUDE_REVIEW } from "@/lib/prisma-order-includes";
import { isReviewOrderEligible } from "@/lib/order-review-eligibility";
import {
  detectReviewPhotoExtension,
  REVIEW_PHOTO_MAX_BYTES,
} from "@/lib/review-policy";
import {
  consumeOrReject,
  createUploadRateLimiter,
} from "@/lib/security/rate-limit";

const uploadLimiter = createUploadRateLimiter();
const idsSchema = z.object({
  orderId: z.string().trim().min(1).max(191),
  productId: z.string().trim().min(1).max(191),
});

export async function POST(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const customer = await customerActor();
    const limited = await consumeOrReject(uploadLimiter, `review:${customer.id}`);
    if (!limited.ok) throw new ApiError(429, "Too many uploads. Try again later.");

    const form = await request.formData();
    const ids = idsSchema.parse({
      orderId: form.get("orderId"),
      productId: form.get("productId"),
    });
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Review photo is required.");
    if (file.size < 1 || file.size > REVIEW_PHOTO_MAX_BYTES) {
      throw new ApiError(400, "Review photo must be 5MB or smaller.");
    }

    const order = await prisma.order.findFirst({
      where: { id: ids.orderId, customerId: customer.id },
      include: ORDER_INCLUDE_REVIEW,
    });
    if (!order || !isReviewOrderEligible(order, customer.id, ids.productId)) {
      throw new ApiError(403, "Only an eligible delivered purchase can upload a review photo.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = detectReviewPhotoExtension(bytes, file.type);
    if (!extension) {
      throw new ApiError(400, "Photo content must be a valid JPG, PNG, or WebP image.");
    }

    const safeCustomerId = customer.id.replace(/[^A-Za-z0-9_-]/g, "");
    if (!safeCustomerId || safeCustomerId !== customer.id) {
      throw new ApiError(400, "Customer account identifier is invalid.");
    }
    const uploadRoot = path.resolve(process.cwd(), "public", "uploads", "reviews");
    const uploadDir = path.resolve(uploadRoot, safeCustomerId);
    if (!uploadDir.startsWith(`${uploadRoot}${path.sep}`)) {
      throw new ApiError(400, "Upload path is invalid.");
    }
    const fileName = `rev-${Date.now()}-${randomUUID()}.${extension}`;
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, fileName), Buffer.from(bytes));
    return {
      id: fileName,
      url: `/uploads/reviews/${safeCustomerId}/${fileName}`,
    };
  });
}
