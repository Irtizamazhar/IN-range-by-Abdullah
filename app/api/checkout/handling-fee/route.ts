import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { consumeOrReject } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/prisma";
import { getMarketplacePrisma } from "@/lib/marketplace-prisma";
import { calculateCoupon, cents, findCoupon, normalizeCouponCode, type CouponLine } from "@/lib/coupon-service";
import { calculateHandlingFee, type HandlingFeeLine } from "@/lib/handling-fee";

export const dynamic = "force-dynamic";
const limiter = new RateLimiterMemory({ points: 60, duration: 60 });

/**
 * Preview of the checkout Handling Fee. Display only: POST /api/orders recalculates it
 * from trusted data and rejects the order if it differs from what the customer saw.
 */
export async function POST(request: NextRequest) {
  return api(async () => {
    sameOrigin(request);
    const customer = await customerActor();
    const gate = await consumeOrReject(limiter, customer.id);
    if (!gate.ok) throw new ApiError(429, "Too many requests. Please wait a minute.");
    const body = await request.json();
    if (!Array.isArray(body.products) || !body.products.length || body.products.length > 50) throw new ApiError(400, "Check your cart.");
    if (body.quoteId) return { handlingFee: 0 };

    const mp = getMarketplacePrisma();
    const feeLines: HandlingFeeLine[] = [];
    const couponLines: CouponLine[] = [];
    for (const entry of body.products) {
      if (!entry || typeof entry.productId !== "string" || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1) throw new ApiError(400, "Invalid cart item.");
      const product = await prisma.product.findFirst({ where: { id: entry.productId, isActive: true }, select: { id: true, price: true, originalPrice: true, category: true, categoryRecordId: true } });
      if (!product) throw new ApiError(400, "A product in your cart is unavailable.");
      const vp = await mp.vendorProduct.findFirst({ where: { publishedProductId: product.id, status: "active" }, include: { vendor: { select: { status: true, specialCommissionRate: true } } } });
      feeLines.push({
        category: vp ? vp.category : product.category,
        vendorSpecialCommissionRate: vp ? (vp.vendor.specialCommissionRate as Prisma.Decimal | null) : null,
        baseCents: cents(product.price) * entry.quantity,
      });
      couponLines.push({ productId: product.id, vendorId: vp?.vendor.status === "approved" ? vp.vendorId : undefined, category: product.category, categoryRecordId: product.categoryRecordId, price: Number(product.price), originalPrice: product.originalPrice == null ? null : Number(product.originalPrice), quantity: entry.quantity });
    }

    // Vendor-funded coupon discounts reduce the commission base, as at order creation.
    if (typeof body.couponCode === "string" && body.couponCode) {
      try {
        const coupon = await findCoupon(prisma, normalizeCouponCode(body.couponCode));
        if (coupon.fundingType === "VENDOR_FUNDED") {
          const result = calculateCoupon(coupon, couponLines, customer.id);
          for (const allocation of result.allocations) {
            const line = feeLines[allocation.index];
            if (line) line.baseCents -= allocation.discount;
          }
        }
      } catch {
        // Invalid coupon: preview without it; order creation re-validates the coupon.
      }
    }

    const fee = await calculateHandlingFee(mp, feeLines);
    return { handlingFee: fee.totalCents / 100 };
  });
}
