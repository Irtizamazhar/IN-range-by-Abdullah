import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { customerProviderAvailability } from "@/lib/auth-provider-config";
import { resolveCustomerOAuth, CustomerOAuthError } from "@/lib/customer-oauth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { customerCookieOptions } from "@/lib/auth-cookies";

const OAUTH_PLACEHOLDER_HASH =
  "$2b$10$UoH4j7Gyt7qR95R5M6b8suXNG7QDGtFKwM9lYjLw9M4iyf2EG6m9e";

export const customerAuthOptions: NextAuthOptions = {
  debug: false,
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(customerProviderAvailability().google
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: { params: { prompt: "select_account" } },
          }),
        ]
      : []),
    ...(customerProviderAvailability().facebook ? [FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!, clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      authorization: { url: "https://www.facebook.com/dialog/oauth", params: { scope: "email,public_profile" } },
    })] : []),
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        if (adminEmail && email === adminEmail) {
          return null;
        }

        const customer = await prisma.customer.findUnique({
          where: { email },
        });
        if (!customer?.isActive) return null;
        if (customer.passwordHash === OAUTH_PLACEHOLDER_HASH || customer.passwordHash.startsWith("oauth-only:")) {
          // OAuth-only accounts must use Google or the verified reset flow.
          // Never let an arbitrary first password claim an OAuth account.
          return null;
        }
        const ok = await bcrypt.compare(password, customer.passwordHash);
        if (!ok) return null;
        return {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone || "",
          role: "customer" as const,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  cookies: customerCookieOptions,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google" && account?.provider !== "facebook") return true;
      try {
        await resolveCustomerOAuth({ provider: account.provider, providerAccountId: account.providerAccountId, profile: (profile || {}) as Record<string, unknown> });
        return true;
      } catch (error) {
        const code = error instanceof CustomerOAuthError ? error.code : "OAuthCallback";
        return `/login?role=customer&mode=signin&error=${code}`;
      }
    },
    async jwt({ token, user, account, trigger, session }) {
      if (account?.provider === "google" || account?.provider === "facebook") {
        const identity = await prisma.customerOAuthAccount.findUnique({ where: { provider_providerAccountId: { provider: account.provider, providerAccountId: account.providerAccountId } }, include: { customer: true } });
        if (!identity?.customer.isActive) throw new Error("AccessDenied");
        const customer = identity.customer;
        token.sub = customer.id; token.email = customer.email; token.name = customer.name;
        token.role = "customer"; token.phone = customer.phone; token.sessionVersion = customer.sessionVersion;
        token.picture = customer.image; return token;
      }
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.sub = user.id;
        token.role = user.role;
        if ("phone" in user && typeof user.phone === "string") {
          token.phone = user.phone;
        }
        try {
          const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
          if (email) {
            const customer = await prisma.customer.findUnique({
              where: { email },
              select: { image: true, sessionVersion: true },
            });
            token.picture = customer?.image ?? null;
            token.sessionVersion = customer?.sessionVersion ?? 0;
          }
        } catch {
          // Keep credentials login resilient even if image lookup fails.
        }
      }
      if (trigger === "update" && session) {
        if (typeof session.name === "string") token.name = session.name;
        if (typeof session.phone === "string") token.phone = session.phone;
      }

      // A password reset increments sessionVersion and revokes older JWTs.
      if (!user && token.role === "customer" && token.sub) {
        const current = await prisma.customer.findUnique({
          where: { id: token.sub },
          select: { sessionVersion: true, isActive: true },
        });
        if (
          !current?.isActive ||
          current.sessionVersion !== Number(token.sessionVersion ?? 0)
        ) {
          token.role = undefined;
          token.invalidated = true;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        session.user.email = token.email as string;
        session.user.name = token.name as string | null;
        session.user.role = token.role as "admin" | "customer" | undefined;
        session.user.phone =
          typeof token.phone === "string" ? token.phone : "";
        session.user.image =
          typeof token.picture === "string" ? token.picture : null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
