import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { ORDER_INCLUDE_REVIEW } from "@/lib/prisma-order-includes";
import { isOrderDeliveredForReview, orderEmailsMatch, orderHasProductLine } from "@/lib/order-review-eligibility";
import { getApprovedReviewsForProduct, getProductReviewDashboard } from "@/lib/review-stats";
export const dynamic = "force-dynamic";
const inputSchema = z.object({ productId: z.string().min(1), orderId: z.string().min(1), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(5000), imageUrl: z.string().max(2048).optional() });
export async function GET(request: Request) { return api(async () => {
  const q = new URL(request.url).searchParams; const productId = q.get("productId");
  if (!productId) { if (q.has("newArrivalId")) return { reviews: [], averageRating: 0, totalCount: 0, breakdown: [] }; throw new ApiError(400, "productId is required."); }
  const [reviews, stats] = await Promise.all([getApprovedReviewsForProduct(productId), getProductReviewDashboard(productId)]);
  return { reviews, ...stats };
}); }
async function save(request: Request, edit: boolean) { return api(async () => {
  sameOrigin(request); const customer = await customerActor(); const input = inputSchema.parse(await request.json());
  if (input.imageUrl && (!input.imageUrl.startsWith("/uploads/reviews/") || input.imageUrl.includes(".."))) throw new ApiError(400, "Please upload a valid review image.");
  return prisma.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: input.orderId }, include: ORDER_INCLUDE_REVIEW });
    if (!order || !orderEmailsMatch(order.customerEmail, customer.email)) throw new ApiError(403, "This purchase does not belong to your account.");
    if (!isOrderDeliveredForReview(order) || !orderHasProductLine(order, input.productId)) throw new ApiError(403, "Only delivered purchases can be reviewed.");
    const existing = await tx.review.findUnique({ where: { customerId_productId: { customerId: customer.id, productId: input.productId } } });
    if (existing && !edit) throw new ApiError(409, "You already reviewed this product. Choose Edit Review.");
    if (!existing && edit) throw new ApiError(404, "Review not found.");
    const data = { withdrawn: false, rating: input.rating, comment: input.comment || "—", ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}), approved: false };
    if (existing) await tx.review.update({ where: { id: existing.id }, data });
    else await tx.review.create({ data: { ...data, productId: input.productId, orderId: input.orderId, customerId: customer.id, name: customer.name, email: customer.email } });
    return { success: true, message: "Your review is awaiting moderation." };
  }, { isolationLevel: "Serializable" });
}); }
export async function POST(request: Request) { return save(request, false); }
export async function PATCH(request: Request) { return save(request, true); }
export async function DELETE(request: Request) { return api(async () => {
  sameOrigin(request); const customer = await customerActor(); const { productId } = z.object({ productId: z.string().min(1) }).parse(await request.json());
  await prisma.review.updateMany({ where: { customerId: customer.id, productId }, data: { approved: false, withdrawn: true } });
  return { success: true };
}); }