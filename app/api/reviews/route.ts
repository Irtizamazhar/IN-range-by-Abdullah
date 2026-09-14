import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { ORDER_INCLUDE_REVIEW } from "@/lib/prisma-order-includes";
import { isReviewOrderEligible } from "@/lib/order-review-eligibility";
import {
  reviewPhotoUrlForCustomer,
  reviewSubmissionSchema,
  reviewWithdrawalSchema,
} from "@/lib/review-policy";
import {
  getApprovedReviewsForProduct,
  getProductReviewDashboard,
} from "@/lib/review-stats";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return api(async () => {
    const query = new URL(request.url).searchParams;
    const productId = query.get("productId")?.trim();

    // Numeric JSON-catalog reviews were historically guest-authored and have
    // no order relation. Preserve their rows, but never publish/count them.
    if (!productId) {
      if (query.has("newArrivalId")) {
        return {
          reviews: [],
          averageRating: 0,
          totalCount: 0,
          breakdown: [],
        };
      }
      throw new ApiError(400, "productId is required.");
    }

    const [reviews, stats] = await Promise.all([
      getApprovedReviewsForProduct(productId),
      getProductReviewDashboard(productId),
    ]);
    return { reviews, ...stats };
  });
}

async function save(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const customer = await customerActor();
    const input = reviewSubmissionSchema.parse(await request.json());

    if (
      input.imageUrl &&
      !reviewPhotoUrlForCustomer(input.imageUrl, customer.id)
    ) {
      throw new ApiError(400, "Please upload a valid review image.");
    }

    return prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: input.orderId },
          include: ORDER_INCLUDE_REVIEW,
        });

        // Return the same result for a missing or foreign order to avoid an
        // order-id enumeration oracle.
        if (!order || order.customerId !== customer.id) {
          throw new ApiError(404, "Eligible purchase not found.");
        }
        if (!isReviewOrderEligible(order, customer.id, input.productId)) {
          throw new ApiError(
            403,
            "Only a delivered purchase containing this product can be reviewed."
          );
        }

        const existingRows = await tx.review.findMany({
          where: { customerId: customer.id, productId: input.productId },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        });
        const existing = existingRows[0];
        const reviewData = {
          orderId: input.orderId,
          name: customer.name,
          email: customer.email,
          rating: input.rating,
          comment: input.comment,
          withdrawn: false,
          // New and edited content follows the existing moderation workflow.
          approved: false,
          ...(input.imageUrl !== undefined
            ? { imageUrl: input.imageUrl || null }
            : {}),
        };

        const review = existing
          ? await tx.review.update({
              where: { id: existing.id },
              data: reviewData,
              select: { id: true, createdAt: true, updatedAt: true },
            })
          : await tx.review.upsert({
              where: {
                customerId_productId: {
                  customerId: customer.id,
                  productId: input.productId,
                },
              },
              update: reviewData,
              create: {
                ...reviewData,
                customerId: customer.id,
                productId: input.productId,
              },
              select: { id: true, createdAt: true, updatedAt: true },
            });

        // A database predating the unique key can contain duplicate legacy
        // rows. Keep that history, but make every non-canonical row inactive.
        if (existingRows.length > 1) {
          await tx.review.updateMany({
            where: {
              id: { in: existingRows.slice(1).map((row) => row.id) },
            },
            data: { approved: false, withdrawn: true },
          });
        }

        return {
          success: true,
          action: existing ? "updated" : "created",
          review: {
            id: String(review.id),
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
          },
          message: existing
            ? "Your review was updated and is awaiting moderation."
            : "Your review is awaiting moderation.",
        };
      },
      { isolationLevel: "Serializable" }
    );
  });
}

// POST is intentionally idempotent at the customer/product level: a repeat
// submission edits the canonical row instead of creating a second review.
export async function POST(request: Request) {
  return save(request);
}

export async function PATCH(request: Request) {
  return save(request);
}

export async function DELETE(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const customer = await customerActor();
    const { productId } = reviewWithdrawalSchema.parse(await request.json());
    const result = await prisma.review.updateMany({
      where: { customerId: customer.id, productId },
      data: { approved: false, withdrawn: true },
    });
    if (!result.count) throw new ApiError(404, "Review not found.");
    return { success: true };
  });
}
