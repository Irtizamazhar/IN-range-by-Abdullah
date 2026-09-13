import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export const publicStoreSelect = {
  id: true, shopName: true, storeSlug: true, shopLogo: true, storeBanner: true,
  primaryCategory: true, shopDescription: true, storePolicies: true, serviceCities: true,
  _count: { select: { storeFollows: true } },
} satisfies Prisma.VendorSelect;
export async function publicStores() {
  return prisma.vendor.findMany({ where: { status: "approved" }, select: publicStoreSelect, orderBy: [{ storeFollows: { _count: "desc" } }, { id: "asc" }], take: 60 });
}
export function storeHref(store: { id: string; storeSlug: string | null }) { return `/stores/${encodeURIComponent(store.storeSlug || store.id)}`; }
export async function activePromotions(now = new Date()) {
  return prisma.vendorPromotion.findMany({
    where: { status: "ACTIVE", placement: "HOMEPAGE", startAt: { lte: now }, endAt: { gt: now }, vendor: { status: "approved" } },
    select: { id: true, title: true, subtitle: true, desktopImage: true, mobileImage: true, ctaText: true, isSponsored: true, vendor: { select: publicStoreSelect } },
    orderBy: [{ priority: "desc" }, { id: "asc" }], take: 8,
  });
}