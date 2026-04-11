import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { adminCookieOptions } from "@/lib/auth-cookies";

export const adminAuthOptions: NextAuthOptions = {
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
        const adminPassword = process.env.ADMIN_PASSWORD;
        const adminHash = process.env.ADMIN_PASSWORD_HASH;

        if (!adminEmail || email !== adminEmail) return null;

        let ok = false;
        if (adminHash && adminHash.startsWith("$2")) {
          ok = await bcrypt.compare(password, adminHash);
        } else if (adminPassword) {
          ok = password === adminPassword;
        }
        if (!ok) return null;
        return {
          id: "admin",
          email: process.env.ADMIN_EMAIL!.trim(),
          name: "Admin",
          role: "admin" as const,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/admin/login" },
  cookies: adminCookieOptions,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.sub = user.id;
        token.role = user.role;
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
