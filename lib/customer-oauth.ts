import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
export type CustomerOAuthProvider = "google" | "facebook";
export class CustomerOAuthError extends Error {
  constructor(public code: "OAuthAccountNotLinked" | "OAuthEmailRequired" | "AccessDenied") { super(code); }
}
/** Called only with the profile obtained by NextAuth's server-side OAuth exchange. */
export async function resolveCustomerOAuth(input: { provider: CustomerOAuthProvider; providerAccountId: string; profile: Record<string, unknown> }) {
  const { provider, providerAccountId, profile } = input;
  const subject = provider === "google" ? profile.sub : profile.id;
  if (!providerAccountId || providerAccountId.length > 191 || subject !== providerAccountId) throw new CustomerOAuthError("AccessDenied");
  const key = { provider, providerAccountId };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const linked = await tx.customerOAuthAccount.findUnique({ where: { provider_providerAccountId: key }, include: { customer: true } });
        if (linked) {
          if (!linked.customer.isActive) throw new CustomerOAuthError("AccessDenied");
          return linked.customer;
        }
        const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255 || (provider === "google" && profile.email_verified !== true)) throw new CustomerOAuthError("OAuthEmailRequired");
        if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) throw new CustomerOAuthError("AccessDenied");
        if (await tx.customer.findUnique({ where: { email }, select: { id: true } })) throw new CustomerOAuthError("OAuthAccountNotLinked");
        return tx.customer.create({ data: {
          email, name: sanitizePlainText(profile.name, 200) || "Customer", provider,
          // Non-bcrypt, random, unusable for password login. Password reset remains the recovery path.
          passwordHash: `oauth-only:${randomBytes(32).toString("hex")}`,
          oauthAccounts: { create: key },
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code) && attempt < 2) continue;
      throw error;
    }
  }
  throw new CustomerOAuthError("AccessDenied");
}