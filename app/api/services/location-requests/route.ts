import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { createSupportTicketRateLimiter, consumeOrReject } from "@/lib/security/rate-limit";
const limiter = createSupportTicketRateLimiter();
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); const session = await getVendorFromSession(); if (!session) throw new ApiError(401, "Vendor sign-in required.");
  if (!(await consumeOrReject(limiter, session.vendor.id)).ok) throw new ApiError(429, "Too many location requests. Please try later.");
  const input = z.object({ city: z.string().trim().min(2).max(200), area: z.string().trim().min(2).max(200), details: z.string().trim().min(3).max(1000) }).parse(await request.json());
  return { request: await prisma.serviceLocationRequest.create({ data: { ...input, vendorId: session.vendor.id } }) };
}); }
