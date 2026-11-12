import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/marketplace-api";
import { getCustomerSession } from "@/lib/sessions";
import { isMailConfigured, sendMail } from "@/lib/mailer";
import { newPrivateToken, tokenHash } from "@/lib/public-feature-security";
import { SITE_URL } from "@/lib/seo";

export const newsletterInput = z.object({ email: z.string().trim().email().max(254).optional(), consent: z.literal(true) });
export async function newsletterCustomer() {
  const session = await getCustomerSession();
  return session?.user?.role === "customer" && session.user.id
    ? prisma.customer.findFirst({ where: { id: session.user.id, isActive: true }, select: { id: true, email: true } }) : null;
}
export async function subscribeNewsletter(input: unknown) {
  const body = newsletterInput.parse(input), customer = await newsletterCustomer();
  const email = z.string().email().max(254).parse(customer?.email || body.email).toLowerCase();
  if (!isMailConfigured()) throw new ApiError(503, "Email confirmation is not available yet. Please try again later.");
  const existing = await prisma.newsletterSubscription.findUnique({ where: { email } });
  // Do not expose account/subscription existence or reassign another subscription by email match.
  if (existing?.status === "SUBSCRIBED") return;
  const confirmation = newPrivateToken(), unsubscribe = newPrivateToken();
  const data = { status: "PENDING", customerId: customer?.id || null, confirmationHash: tokenHash(confirmation), confirmationExpiresAt: new Date(Date.now() + 86400000), unsubscribeHash: tokenHash(unsubscribe), consentAt: new Date(), unsubscribedAt: null };
  await prisma.newsletterSubscription.upsert({ where: { email }, create: { email, ...data }, update: data });
  const confirmLink = `${SITE_URL}/newsletter/confirm#token=${confirmation}`;
  const unsubscribeLink = `${SITE_URL}/newsletter/unsubscribe#token=${unsubscribe}`;
  const sent = await sendMail({ to: email, subject: "Confirm your JORO newsletter subscription", text: `Confirm your request: ${confirmLink}\nCancel or unsubscribe: ${unsubscribeLink}`, html: `<p>You requested JORO newsletter updates. Confirm only if this was you.</p><p><a href="${confirmLink}">Confirm subscription</a></p><p><a href="${unsubscribeLink}">Cancel or unsubscribe</a></p>` });
  if (!sent) throw new ApiError(503, "Confirmation could not be delivered. Please try again later.");
}
export async function newsletterToken(action: "confirm" | "unsubscribe", token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError(400, "Invalid link.");
  const now = new Date();
  return prisma.$transaction(async tx => {
    const subscription = await tx.newsletterSubscription.findFirst({ where: action === "confirm" ? { confirmationHash: tokenHash(token), status: "PENDING", confirmationExpiresAt: { gt: now } } : { unsubscribeHash: tokenHash(token) } });
    if (!subscription) throw new ApiError(400, "This link is invalid or expired.");
    const changed = await tx.newsletterSubscription.updateMany({ where: { id: subscription.id, ...(action === "confirm" ? { confirmationHash: tokenHash(token), status: "PENDING" } : {}) }, data: action === "confirm" ? { status: "SUBSCRIBED", confirmedAt: now, confirmationHash: null, confirmationExpiresAt: null } : { status: "UNSUBSCRIBED", unsubscribedAt: now, confirmationHash: null } });
    if (changed.count !== 1) throw new ApiError(409, "This link has already been used.");
    if (subscription.customerId) await tx.customer.updateMany({ where: { id: subscription.customerId, isActive: true, email: subscription.email }, data: action === "confirm" ? { marketingEmailConsentAt: now, marketingEmailUnsubscribedAt: null } : { marketingEmailConsentAt: null, marketingEmailUnsubscribedAt: now } });
    return { ok: true };
  });
}
