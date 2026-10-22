import { NextRequest } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { consumeOrReject } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/prisma";
import { calculateHandlingFee } from "@/lib/handling-fee";

export const dynamic = "force-dynamic";
const limiter = new RateLimiterMemory({ points: 60, duration: 60 });

/**
 * Compatibility preview for the old fee field. New orders pay no separate handling fee;
 * POST /api/orders checks the same zero amount while delivery comes from settings or quote.
 */
export async function POST(request: NextRequest) {
  return api(async () => {
    sameOrigin(request);
    const customer = await customerActor();
    const gate = await consumeOrReject(limiter, customer.id);
    if (!gate.ok) throw new ApiError(429, "Too many requests. Please wait a minute.");
    const body = await request.json();
    if (!Array.isArray(body.products) || !body.products.length || body.products.length > 50) throw new ApiError(400, "Check your cart.");
    if (body.quoteId) return { handlingFee: calculateHandlingFee() };

    for (const entry of body.products) {
      if (!entry || typeof entry.productId !== "string" || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1) throw new ApiError(400, "Invalid cart item.");
      const product = await prisma.product.findFirst({ where: { id: entry.productId, isActive: true }, select: { id: true } });
      if (!product) throw new ApiError(400, "A product in your cart is unavailable.");
    }

    return { handlingFee: calculateHandlingFee() };
  });
}
