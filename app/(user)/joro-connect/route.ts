import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/app-url";
import { SITE_URL } from "@/lib/seo";

/**
 * JORO Connect was merged into Wants. A route handler (not a page) so old links get a real
 * 308 from the server; filters carry over: type, city and search (as q).
 */
export function GET(request: Request) {
  const from = new URL(request.url).searchParams;
  const params = new URLSearchParams(from);
  params.set("tab", "all");
  params.delete("search");
  params.delete("type");
  params.delete("city");
  const type = (from.get("type") || "").toUpperCase();
  if (type === "PRODUCT" || type === "SERVICE" || type === "GIFT") params.set("type", type);
  const city = (from.get("city") || "").trim().slice(0, 100);
  if (city) params.set("city", city);
  const search = (from.get("search") || "").trim().slice(0, 100);
  if (from.has("search")) {
    params.delete("q");
    if (search) params.set("q", search);
  }
  const origin = process.env.NODE_ENV === "production" ? SITE_URL : appOrigin();
  return NextResponse.redirect(new URL(`/wants?${params.toString()}`, origin), 308);
}
