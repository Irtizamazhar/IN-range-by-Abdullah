import { prisma } from "@/lib/prisma";
import { StoreDirectory } from "@/components/user/StoreDirectory";
import { vendorReviewStatsService } from "@/lib/vendor-review-stats-service";
import { getCustomerSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const vendors = await prisma.vendor.findMany({
    where: { status: "approved" },
    orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }],
    select: {
      id: true, shopName: true, storeSlug: true, shopLogo: true, storeBanner: true,
      shopDescription: true, primaryCategory: true, city: true,
      _count: { select: { followers: true, products: true } },
      vendorShopOrders: { where: { status: "delivered" }, select: { id: true } },
    },
  });
  const ratingStats = await vendorReviewStatsService(vendors.map(vendor => vendor.id));
  const session = await getCustomerSession();
  const follows = session?.user?.role === "customer" && session.user.id
    ? await prisma.storeFollow.findMany({
        where: { customerId: session.user.id, vendorId: { in: vendors.map(vendor => vendor.id) } },
        select: { vendorId: true },
      })
    : [];
  const followed = new Set(follows.map(follow => follow.vendorId));

  return <StoreDirectory stores={vendors.map(vendor => {
    const rating = ratingStats.get(vendor.id);
    return {
      id: vendor.id, shopName: vendor.shopName, storeSlug: vendor.storeSlug,
      shopLogo: vendor.shopLogo, storeBanner: vendor.storeBanner,
      primaryCategory: vendor.primaryCategory, shopDescription: vendor.shopDescription,
      city: vendor.city, rating: rating?.reviewCount ? rating.ratingAvg : null,
      ratingCount: rating?.reviewCount ?? 0, deliveredCount: vendor.vendorShopOrders.length,
      _count: vendor._count, initialFollowing: followed.has(vendor.id),
    };
  })} />;
}
