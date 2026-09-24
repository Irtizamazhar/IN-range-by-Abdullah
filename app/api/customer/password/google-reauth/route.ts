import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { isOAuthOnlyPasswordHash, createPasswordReauthIntent, CUSTOMER_PASSWORD_REAUTH_COOKIE, CUSTOMER_PASSWORD_REAUTH_MAX_AGE_SECONDS } from "@/lib/customer-password-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const customer = await customerActor();
    const identity = await prisma.customer.findUnique({
      where: { id: customer.id },
      select: { passwordHash: true, oauthAccounts: { where: { provider: "google" }, select: { id: true } } },
    });
    if (!identity || identity.oauthAccounts.length === 0) return NextResponse.json({ error: "Google reauthentication is required for this action." }, { status: 403 });
    if (!isOAuthOnlyPasswordHash(identity.passwordHash)) return NextResponse.json({ error: "Use Forgot Password to change your website password." }, { status: 409 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(CUSTOMER_PASSWORD_REAUTH_COOKIE, createPasswordReauthIntent(customer.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: CUSTOMER_PASSWORD_REAUTH_MAX_AGE_SECONDS });
    return response;
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("customer password reauth start", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Could not start Google reauthentication." }, { status: 500 });
  }
}