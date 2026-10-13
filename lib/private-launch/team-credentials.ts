import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hasLocalPassword } from "@/lib/customer-password-security";
import { isPreviewEmailAllowed } from "@/lib/private-launch/session";

/** Compared against when no account matches, so response time does not reveal which emails exist. */
const DUMMY_BCRYPT_HASH = "$2b$12$QPsnLPsXDmWop537RVbpc.sIfmyG/w2LATsj/za4UYi.DBm9i6k3u";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Verifies a team member against EXISTING accounts — never creates or changes one.
 * Only emails on PREVIEW_ALLOWED_EMAILS can succeed; an ordinary registered
 * customer who is not on the list is always rejected.
 *
 * Accepted credentials, in order: the environment admin (ADMIN_EMAIL with
 * ADMIN_PASSWORD_HASH or ADMIN_PASSWORD), an active AdminUser, or an active
 * Customer with a local (non-OAuth) password.
 */
export async function verifyTeamCredentials(rawEmail: string, password: string): Promise<string | null> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !password || !isPreviewEmailAllowed(email)) {
    await bcrypt.compare(password || "x", DUMMY_BCRYPT_HASH);
    return null;
  }

  const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (envAdminEmail && email === envAdminEmail) {
    const hash = process.env.ADMIN_PASSWORD_HASH;
    const plain = process.env.ADMIN_PASSWORD;
    if (hash?.startsWith("$2")) {
      if (await bcrypt.compare(password, hash)) return email;
    } else if (plain && safeEqual(password, plain)) {
      return email;
    }
  }

  const admin = await prisma.adminUser.findUnique({
    where: { email },
    select: { isActive: true, passwordHash: true },
  });
  if (admin?.isActive && (await bcrypt.compare(password, admin.passwordHash))) return email;

  const customer = await prisma.customer.findUnique({
    where: { email },
    select: { isActive: true, passwordHash: true },
  });
  if (customer?.isActive && hasLocalPassword(customer.passwordHash)) {
    if (await bcrypt.compare(password, customer.passwordHash)) return email;
  } else if (!admin) {
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
  }
  return null;
}
