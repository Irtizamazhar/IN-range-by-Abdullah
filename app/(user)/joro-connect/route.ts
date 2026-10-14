import { NextResponse } from "next/server";

/**
 * JORO Connect was merged into Wants. A route handler (not a page) so old links get a real
 * 308 from the server; filters carry over: type, city and search (as q).
 */
export function GET(request: Request) {
  const from = new URL(request.url).searchParams;
  const params = new URLSearchParams({ tab: "all" });
  const type = (from.get("type") || "").toUpperCase();
  if (type === "PRODUCT" || type === "SERVICE" || type === "GIFT") params.set("type", type);
  const city = (from.get("city") || "").trim().slice(0, 100);
  if (city) params.set("city", city);
  const search = (from.get("search") || "").trim().slice(0, 100);
  if (search) params.set("q", search);
  return NextResponse.redirect(new URL(`/wants?${params.toString()}`, request.url), 308);
}
