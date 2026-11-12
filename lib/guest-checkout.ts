import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { incrementalFeatures } from "@/lib/incremental-features";
import { ApiError, customerActor } from "@/lib/marketplace-api";
import { privateCookie, tokenHash } from "@/lib/public-feature-security";
export const GUEST_CHECKOUT_COOKIE = "joro_guest_checkout";
export function guestOwnerHash() {
  if (!incrementalFeatures().guestCheckout) throw new ApiError(401, "Please sign in to check out.");
  const token = privateCookie(GUEST_CHECKOUT_COOKIE);
  if (!token) throw new ApiError(401, "Choose Continue as Guest before placing your order.");
  return tokenHash(token);
}
export function guestEmail(value: unknown) { const result = z.union([z.string().trim().email().max(254), z.literal(""), z.undefined()]).safeParse(value); if (!result.success) throw new ApiError(400, "Enter a valid email address or leave it blank."); return result.data?.toLowerCase() || ""; }
export async function checkoutPreviewActor() {
  try { const customer = await customerActor(); return { id: customer.id, couponIdentity: customer.id, guest: false }; }
  catch (e) { if (!(e instanceof ApiError) || e.status !== 401) throw e; const hash = guestOwnerHash(); return { id: null, couponIdentity: `guest:${hash}`, guest: true }; }
}
export async function ownsGuestOrder(orderId: string, ownerHash: string) { return Boolean(await prisma.guestOrderAccess.findFirst({ where: { orderId, ownerHash, expiresAt: { gt: new Date() } }, select: { orderId: true } })); }
export function guestCouponAllowed(coupon: { perCustomerLimit: number | null; customerIds: unknown }) {
  if (coupon.perCustomerLimit != null || Array.isArray(coupon.customerIds) && coupon.customerIds.length > 0) throw new ApiError(400, "Sign in to use an account-limited coupon. Your cart is preserved.");
}
