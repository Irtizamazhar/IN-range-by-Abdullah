import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { adminCookieOptions } from "@/lib/auth-cookies";
import { prisma } from "@/lib/prisma";
import { normalizePermissions, permissionsForRole } from "@/lib/admin-permissions";

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

        if (adminEmail && email === adminEmail) {
          let ok = false;
          if (adminHash && adminHash.startsWith("$2")) {
            ok = await bcrypt.compare(password, adminHash);
          } else if (adminPassword) {
            ok = password === adminPassword;
          }
          if (!ok) return null;
          const storedHash = adminHash && adminHash.startsWith("$2")
            ? adminHash
            : await bcrypt.hash(password, 12);
          try {
            const row = await prisma.adminUser.upsert({
              where: { email: adminEmail },
              update: {
                passwordHash: storedHash,
                role: "super_admin",
                permissions: ["*"],
                isActive: true,
                lastLoginAt: new Date(),
              },
              create: {
                email: adminEmail,
                passwordHash: storedHash,
                name: "Admin",
                role: "super_admin",
                permissions: ["*"],
                lastLoginAt: new Date(),
              },
            });
            return { id: row.id, email: row.email, name: row.name, role: "admin" as const, adminRole: row.role, permissions: ["*"] };
          } catch (error) {
            console.error("Could not sync environment admin to database", error);
            return { id: "admin", email: adminEmail, name: "Admin", role: "admin" as const, adminRole: "super_admin", permissions: ["*"] };
          }
        }

        const row = await prisma.adminUser.findUnique({ where: { email } });
        if (!row?.isActive || !(await bcrypt.compare(password, row.passwordHash))) return null;
        await prisma.adminUser.update({ where: { id: row.id }, data: { lastLoginAt: new Date() } });
        const permissions = Array.from(new Set([...permissionsForRole(row.role), ...normalizePermissions(row.permissions)]));
        return { id: row.id, email: row.email, name: row.name, role: "admin" as const, adminRole: row.role, permissions };
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
        token.adminRole = user.adminRole;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "admin";
        session.user.email = token.email as string;
        session.user.name = token.name as string | null;
        session.user.role = token.role as "admin" | "customer" | undefined;
        session.user.phone =
          typeof token.phone === "string" ? token.phone : "";
        session.user.adminRole = token.adminRole;
        session.user.permissions = token.permissions;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
