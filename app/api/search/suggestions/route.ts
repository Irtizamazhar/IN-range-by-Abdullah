import { NextRequest, NextResponse } from "next/server";
import { readSearchSuggestions } from "@/lib/search-suggestions";
import { createApiRateLimiter, consumeOrReject } from "@/lib/security/rate-limit";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";
const limiter = createApiRateLimiter();
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  if (query.length > 100) return NextResponse.json({ items: [], error: "Search must be 100 characters or fewer." }, { status: 400, headers });
  const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = await consumeOrReject(limiter, createHash("sha256").update(address).digest("hex"));
  if (!rate.ok) return NextResponse.json({ items: [], error: "Please wait before searching again." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retrySecs) } });
  try {
    const items = await readSearchSuggestions(query);
    return NextResponse.json({ items }, { headers });
  } catch {
    return NextResponse.json({ items: [], error: "Suggestions unavailable" }, { status: 503, headers });
  }
}
