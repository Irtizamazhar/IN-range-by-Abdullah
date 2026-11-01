import { z } from "zod";
import { api, ApiError } from "@/lib/marketplace-api";
import { createApiRateLimiter, consumeOrReject } from "@/lib/security/rate-limit";
import { placeSchema } from "@/lib/service-coverage";
import { searchServiceLocations } from "@/lib/service-locations";
export const dynamic = "force-dynamic";
const limiter = createApiRateLimiter();
export async function GET(request: Request) { return api(async () => {
  if (!(await consumeOrReject(limiter, request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown")).ok) throw new ApiError(429, "Too many location searches. Please wait.");
  const q = new URL(request.url).searchParams;
  const search = z.string().trim().min(2).max(100).parse(q.get("q"));
  const city = q.get("city") ? placeSchema.parse(JSON.parse(q.get("city")!)) : undefined;
  return { locations: await searchServiceLocations(search, city) };
}); }
