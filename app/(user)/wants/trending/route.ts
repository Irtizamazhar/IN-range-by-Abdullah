import { NextResponse } from "next/server";

/** Trending Wants is a tab of the unified Wants feed. */
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/wants?tab=trending", request.url), 308);
}
