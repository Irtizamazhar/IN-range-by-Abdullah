import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/app-url";
import { SITE_URL } from "@/lib/seo";

/** Trending Wants is a tab of the unified Wants feed. */
export function GET(request: Request) {
  const params = new URLSearchParams(new URL(request.url).searchParams);
  params.set("tab", "trending");
  const origin = process.env.NODE_ENV === "production" ? SITE_URL : appOrigin();
  return NextResponse.redirect(new URL(`/wants?${params.toString()}`, origin), 308);
}
