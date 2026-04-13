import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { customerCookieOptions } from "@/lib/auth-cookies";

const OAUTH_PLACEHOLDER_HASH =
  "$2b$10$UoH4j7Gyt7qR95R5M6b8suXNG7QDGtFKwM9lYjLw9M4iyf2EG6m9e";

let oauthColumnsEnsured = false;
async function ensureOauthColumns() {
  if (oauthColumnsEnsured) return;

  const rows = await prisma.$queryRawUnsafe<
    Array<{ COLUMN_NAME: string }>
  >(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Customer' AND COLUMN_NAME IN ('image', 'provider')"
  );
  const names = new Set(rows.map((r) => r.COLUMN_NAME));

  if (!names.has("image")) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `Customer` ADD COLUMN `image` VARCHAR(2048) NULL"
    );
  }
  if (!names.has("provider")) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `Customer` ADD COLUMN `provider` VARCHAR(32) NULL"
    );
  }
  oauthColumnsEnsured = true;
}

export const customerAuthOptions: NextAuthOptions = {
  debug: true,
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
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
        if (customer.passwordHash === OAUTH_PLACEHOLDER_HASH) {
          // Allow Google-created accounts to set a local password on first
          // credentials login attempt.
          if (password.length < 6) return null;
          const localHash = await bcrypt.hash(password, 10);
          await prisma.customer.update({
            where: { id: customer.id },
            data: { passwordHash: localHash },
          });
          return {
            id: customer.id,
            email: customer.email,
            name: customer.name,
            phone: customer.phone || "",
            role: "customer" as const,
          };
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
    async signIn({ user, account }) {
      try {
        if (account?.provider === "google") {
          const email = user?.email?.trim().toLowerCase();
          const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
          if (!email) return false;
          if (adminEmail && email === adminEmail) return false;

          // Persist provider + profile image once columns exist.
          await ensureOauthColumns();
          const safeName = user?.name?.trim() || "Customer";

          // Upsert by raw SQL to avoid Prisma model/client drift issues.
          await prisma.$executeRawUnsafe(
            "INSERT INTO `Customer` (`id`, `email`, `passwordHash`, `name`, `phone`, `createdAt`, `updatedAt`) VALUES (UUID(), ?, ?, ?, '', NOW(), NOW()) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `updatedAt` = NOW()",
            email,
            OAUTH_PLACEHOLDER_HASH,
            safeName
          );

          const row = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
            "SELECT `id` FROM `Customer` WHERE `email` = ? LIMIT 1",
            email
          );
          const customerId = row?.[0]?.id;
          if (!customerId) {
            throw new Error("Google sign-in customer row missing after upsert");
          }

          await prisma.$executeRawUnsafe(
            "UPDATE `Customer` SET `provider` = ?, `image` = ? WHERE `id` = ?",
            "google",
            user?.image ?? null,
            customerId
          );
        }
        return true;
      } catch (error) {
        console.error("SignIn error:", error);
        return false;
      }
    },
    async jwt({ token, user, account, trigger, session }) {
      if (account?.provider === "google" && user?.email) {
        token.sub = token.sub ?? user.id ?? user.email;
        token.email = user.email;
        token.name = user.name;
        token.role = "customer";
        token.phone = "";
        token.picture = user.image ?? null;
        return token;
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
            const rows = await prisma.$queryRawUnsafe<Array<{ image: string | null }>>(
              "SELECT `image` FROM `Customer` WHERE `email` = ? LIMIT 1",
              email
            );
            token.picture = rows?.[0]?.image ?? null;
          }
        } catch {
          // Keep credentials login resilient even if image lookup fails.
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
        session.user.image =
          typeof token.picture === "string" ? token.picture : null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
