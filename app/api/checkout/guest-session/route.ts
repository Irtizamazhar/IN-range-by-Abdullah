import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/marketplace-api";
import { incrementalFeatures } from "@/lib/incremental-features";
import { GUEST_CHECKOUT_COOKIE } from "@/lib/guest-checkout";
import { featureRate, featureWrite, privateCookie, newPrivateToken, privateCookieOptions, requestAddress } from "@/lib/public-feature-security";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ enabled: incrementalFeatures().guestCheckout, active: incrementalFeatures().guestCheckout && Boolean(privateCookie(GUEST_CHECKOUT_COOKIE)) }, { headers: { "Cache-Control": "private, no-store" } }); }
export async function POST(request: Request) { return api(async () => { if (!incrementalFeatures().guestCheckout) throw new ApiError(404, "Guest checkout is not enabled yet."); featureWrite(request); await featureRate("guest-session", requestAddress(request), 20, 3600); const response = NextResponse.json({ ok: true }); response.cookies.set(GUEST_CHECKOUT_COOKIE, privateCookie(GUEST_CHECKOUT_COOKIE) || newPrivateToken(), privateCookieOptions); return response; }); }
