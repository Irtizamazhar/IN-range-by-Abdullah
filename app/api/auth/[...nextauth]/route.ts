export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import type { NextRequest } from "next/server";
import { customerAuthOptions } from "@/lib/customer-auth-options";
import { CUSTOMER_OAUTH_REMEMBER_COOKIE } from "@/lib/customer-remember-policy";
import { applyCustomerCookiePersistence } from "@/lib/customer-session-cookie";

async function handler(req: NextRequest, context: { params: { nextauth: string[] } }) {
  const googleCallback = context.params.nextauth[0] === "callback" && context.params.nextauth[1] === "google";
  const callbacks = customerAuthOptions.callbacks!;
  const options: NextAuthOptions = googleCallback ? {
    ...customerAuthOptions,
    callbacks: {
      ...callbacks,
      async jwt(args) {
        const token = await callbacks.jwt!(args);
        if (args.account?.provider === "google") token.rememberMe = req.cookies.get(CUSTOMER_OAUTH_REMEMBER_COOKIE)?.value === "1";
        return token;
      },
    },
  } : customerAuthOptions;
  const response = await NextAuth(options)(req, context);
  await applyCustomerCookiePersistence(response, options.secret);
  if (googleCallback) response.headers.append("set-cookie", `${CUSTOMER_OAUTH_REMEMBER_COOKIE}=; Path=/api/auth; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}

export { handler as GET, handler as POST };
