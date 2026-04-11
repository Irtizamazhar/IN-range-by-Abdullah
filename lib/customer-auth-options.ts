import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { customerCookieOptions } from "@/lib/auth-cookies";

export const customerAuthOptions: NextAuthOptions = {
  providers: [
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
        if (!customer) return null;
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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.sub = user.id;
        token.role = user.role;
        if ("phone" in user && typeof user.phone === "string") {
          token.phone = user.phone;
        }
      }
      if (trigger === "update" && session) {
        if (typeof session.name === "string") token.name = session.name;
        if (typeof session.phone === "string") token.phone = session.phone;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string | null;
        session.user.role = token.role as "admin" | "customer" | undefined;
        session.user.phone =
          typeof token.phone === "string" ? token.phone : "";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
