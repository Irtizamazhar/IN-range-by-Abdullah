import { prisma } from "@/lib/prisma";
import { StoreCard } from "@/components/user/StoreCard";
import { vendorReviewStatsService } from "@/lib/vendor-review-stats-service";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const vendors = await prisma.vendor.findMany({
    where: { status: "approved" },
    orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }],
    select: {
      id: true,
      shopName: true,
      storeSlug: true,
      shopLogo: true,
      shopDescription: true,
      primaryCategory: true,
      city: true,
      _count: { select: { followers: true, products: true } },
      vendorShopOrders: { where: { status: "delivered" }, select: { id: true } },
    },
  });
  const ratingStats = await vendorReviewStatsService(
    vendors.map((vendor) => vendor.id)
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-black uppercase tracking-wider text-brand-link">Seller network</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-brand-dark">Stores you can trust</h1>
        <p className="mt-2 text-base text-darkText/65">
          Browse approved sellers. Ratings, delivered orders, products, and follower counts come from real marketplace records.
        </p>
      </div>
      {vendors.length ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => {
            const rating = ratingStats.get(vendor.id) ?? {
              ratingAvg: 0,
              reviewCount: 0,
            };
            return (
              <StoreCard
                key={vendor.id}
                store={{
                  id: vendor.id,
                  shopName: vendor.shopName,
                  storeSlug: vendor.storeSlug,
                  shopLogo: vendor.shopLogo,
                  primaryCategory: vendor.primaryCategory,
                  shopDescription: vendor.shopDescription,
                  city: vendor.city,
                  rating: rating.reviewCount ? rating.ratingAvg : null,
                  ratingCount: rating.reviewCount,
                  deliveredCount: vendor.vendorShopOrders.length,
                  _count: vendor._count,
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-borderGray bg-white p-10 text-center text-darkText/60">
          Approved stores will appear here.
        </div>
      )}
    </main>
  );
}
