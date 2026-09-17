import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeAccountLink } from "@/lib/customer-account-policy";
import { PROMOTION_PLACEMENTS } from "@/lib/promotion-service";
export const publicStoreSelect = {
  id: true, shopName: true, storeSlug: true, shopLogo: true, storeBanner: true,
  primaryCategory: true, shopDescription: true, storePolicies: true, serviceCities: true,
  _count: { select: { followers: true } },
} satisfies Prisma.VendorSelect;
export async function publicStores() {
  return prisma.vendor.findMany({ where: { status: "approved" }, select: publicStoreSelect, orderBy: [{ followers: { _count: "desc" } }, { id: "asc" }], take: 60 });
}
export function storeHref(store: { id: string; storeSlug?: string | null }) { return `/stores/${encodeURIComponent(store.storeSlug || store.id)}`; }
/** A promotion's CTA prefers its own safe override; falls back to the vendor's canonical store page. */
export function promotionHref(promotion: { ctaHref: string | null; vendor: { id: string; storeSlug?: string | null } }) {
  return safeAccountLink(promotion.ctaHref) ?? storeHref(promotion.vendor);
}
export async function activePromotions(now = new Date()) {
  return prisma.vendorPromotion.findMany({
    where: { status: "ACTIVE", placement: { in: [...PROMOTION_PLACEMENTS] }, startAt: { lte: now }, OR: [{ endAt: null }, { endAt: { gt: now } }], vendor: { status: "approved" } },
    select: { id: true, title: true, subtitle: true, desktopImage: true, mobileImage: true, ctaText: true, ctaHref: true, placement: true, isSponsored: true, vendor: { select: publicStoreSelect } },
    orderBy: [{ priority: "desc" }, { id: "asc" }], take: 8,
  });
}
/** Admin-curated "Top Vendors" -- independent of VendorPromotion; disappears automatically once the vendor is no longer approved. */
export async function topVendors(take = 4) {
  const rows = await prisma.topVendor.findMany({
    where: { enabled: true, vendor: { status: "approved" } },
    select: { id: true, label: true, priority: true, vendor: { select: publicStoreSelect } },
    orderBy: [{ priority: "desc" }, { id: "asc" }], take,
  });
  return rows;
}