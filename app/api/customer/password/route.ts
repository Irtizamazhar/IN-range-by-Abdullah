import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/auth-cookies";
import { hasLocalPassword, verifyPasswordReauthIntent, CUSTOMER_PASSWORD_REAUTH_COOKIE } from "@/lib/customer-password-security";
import { ApiError, sameOrigin } from "@/lib/marketplace-api";

export const dynamic = "force-dynamic";

const schema = z.object({ password: z.string().min(8).max(128), confirmPassword: z.string().min(8).max(128) }).refine((value) => value.password === value.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });

export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET, cookieName: CUSTOMER_SESSION_COOKIE });
    if (token?.role !== "customer" || typeof token.sub !== "string") return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const reauth = verifyPasswordReauthIntent(cookies().get(CUSTOMER_PASSWORD_REAUTH_COOKIE)?.value);
    const googleAuthenticatedAt = typeof token.googleAuthenticatedAt === "number" ? token.googleAuthenticatedAt : 0;
    if (!reauth || reauth.customerId !== token.sub || googleAuthenticatedAt < reauth.issuedAt) return NextResponse.json({ error: "Please complete recent Google reauthentication first." }, { status: 403 });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Use a password with at least 8 characters." }, { status: 400 });
    const customer = await prisma.customer.findUnique({ where: { id: token.sub, isActive: true }, select: { id: true, passwordHash: true, oauthAccounts: { where: { provider: "google" }, select: { id: true } } } });
    if (!customer || customer.oauthAccounts.length === 0) return NextResponse.json({ error: "Google reauthentication is required for this action." }, { status: 403 });
    if (hasLocalPassword(customer.passwordHash)) return NextResponse.json({ error: "Use Forgot Password to change your website password." }, { status: 409 });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await prisma.customer.update({ where: { id: customer.id }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(CUSTOMER_PASSWORD_REAUTH_COOKIE);
    return response;
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("customer password set", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Could not set your website password." }, { status: 500 });
  }
}