import { NextResponse } from "next/server";

/** Joined requests now live in the Wants feed's Joined tab. */
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/wants?tab=joined", request.url), 308);
}
