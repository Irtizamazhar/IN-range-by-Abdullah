import { NextRequest } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { consumeOrReject } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/prisma";
import { calculateCoupon, findCoupon, normalizeCouponCode, type CouponLine } from "@/lib/coupon-service";

export const dynamic = "force-dynamic";
const limiter = new RateLimiterMemory({ points: 8, duration: 60 });

export async function POST(request: NextRequest) {
  return api(async () => {
    sameOrigin(request);
    const customer = await customerActor();
    const gate = await consumeOrReject(limiter, customer.id);
    if (!gate.ok) throw new ApiError(429, "Too many coupon attempts. Please wait a minute.");
    const body = await request.json();
    const code = normalizeCouponCode(body.code);
    if (!Array.isArray(body.products) || !body.products.length || body.products.length > 50 || body.quoteId) throw new ApiError(400, "Check your cart before applying a coupon.");
    const lines: CouponLine[] = [];
    for (const entry of body.products) {
      if (!entry || typeof entry.productId !== "string" || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1) throw new ApiError(400, "Invalid cart item.");
      const product = await prisma.product.findFirst({ where: { id: entry.productId, isActive: true }, select: { id: true, price: true, originalPrice: true, category: true, categoryRecordId: true } });
      if (!product) throw new ApiError(400, "A product in your cart is unavailable.");
      const vendor = await prisma.vendorProduct.findFirst({ where: { publishedProductId: product.id, status: "active", vendor: { status: "approved" } }, select: { vendorId: true } });
      lines.push({ productId: product.id, vendorId: vendor?.vendorId, category: product.category, categoryRecordId: product.categoryRecordId, price: Number(product.price), originalPrice: Number(product.originalPrice), quantity: entry.quantity });
    }
    const coupon = await findCoupon(prisma, code);
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) throw new ApiError(400, "Coupon usage limit has been reached.");
    if (coupon.perCustomerLimit != null && await prisma.couponRedemption.count({ where: { couponId: coupon.id, customerId: customer.id, status: "redeemed" } }) >= coupon.perCustomerLimit) throw new ApiError(400, "You have reached this coupon's usage limit.");
    const result = calculateCoupon(coupon, lines, customer.id);
    if (coupon.budget != null && Number(coupon.spent) + result.discount / 100 > Number(coupon.budget)) throw new ApiError(400, "Coupon budget has been reached.");
    return { code, discount: result.discount / 100, eligibleProductIds: result.allocations.map(a => a.productId) };
  });
}
