import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
export type CustomerOAuthProvider = "google";
export class CustomerOAuthError extends Error {
  constructor(public code: "OAuthAccountNotLinked" | "OAuthEmailRequired" | "AccessDenied") { super(code); }
}
/** Called only with the profile obtained by NextAuth's server-side OAuth exchange. */
export async function resolveCustomerOAuth(input: { provider: CustomerOAuthProvider; providerAccountId: string; profile: Record<string, unknown> }) {
  const { provider, providerAccountId, profile } = input;
  const subject = provider === "google" ? profile.sub : profile.id;
  if (!providerAccountId || providerAccountId.length > 191 || subject !== providerAccountId) throw new CustomerOAuthError("AccessDenied");
  const image = typeof profile.picture === "string"
    ? profile.picture
    : profile.picture && typeof profile.picture === "object" && "data" in profile.picture && typeof profile.picture.data === "object" && profile.picture.data && "url" in profile.picture.data && typeof profile.picture.data.url === "string"
      ? profile.picture.data.url
      : null;
  const key = { provider, providerAccountId };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const linked = await tx.customerOAuthAccount.findUnique({ where: { provider_providerAccountId: key }, include: { customer: true } });
        if (linked) {
          if (!linked.customer.isActive) throw new CustomerOAuthError("AccessDenied");
          if (image && linked.customer.image !== image) {
            await tx.customer.update({ where: { id: linked.customer.id }, data: { image } });
          }
          return linked.customer;
        }
        const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255 || (provider === "google" && profile.email_verified !== true)) throw new CustomerOAuthError("OAuthEmailRequired");
        if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) throw new CustomerOAuthError("AccessDenied");
        const existing = await tx.customer.findUnique({ where: { email } });
        if (existing) {
          if (!existing.isActive) throw new CustomerOAuthError("OAuthAccountNotLinked");
          return tx.customer.update({
            where: { id: existing.id },
            data: {
              name: sanitizePlainText(profile.name, 200) || existing.name,
              image: image || existing.image,
              oauthAccounts: { create: key },
            },
          });
        }
        return tx.customer.create({ data: {
          email, name: sanitizePlainText(profile.name, 200) || "Customer", image, provider,
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