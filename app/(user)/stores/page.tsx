import Link from "next/link";
import { Store, MapPin, PackageCheck, Star } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const vendors = await prisma.vendor.findMany({
    where: { status: "approved" },
    orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }],
    select: {
      id: true,
      shopName: true,
      shopDescription: true,
      primaryCategory: true,
      city: true,
      shopLogo: true,
      _count: { select: { followers: true, products: true } },
      reviews: { where: { isVisible: true }, select: { rating: true } },
      vendorShopOrders: { where: { status: "delivered" }, select: { id: true } },
    },
  });

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
            const rating = vendor.reviews.length
              ? vendor.reviews.reduce((sum, review) => sum + review.rating, 0) / vendor.reviews.length
              : null;
            return (
              <Link key={vendor.id} href={`/stores/${vendor.id}`} className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-primary/40">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary text-lg font-black text-brand-dark">
                    {vendor.shopName.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black text-brand-dark">{vendor.shopName}</h2>
                    <p className="text-sm font-semibold text-brand-link">{vendor.primaryCategory}</p>
                  </div>
                </div>
                <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-darkText/60">
                  {vendor.shopDescription || "Approved marketplace seller"}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-darkText/65">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{vendor.city}</span>
                  <span className="inline-flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5" />{vendor.vendorShopOrders.length} delivered</span>
                  <span className="inline-flex items-center gap-1"><Store className="h-3.5 w-3.5" />{vendor._count.products} products</span>
                  <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" />{rating ? rating.toFixed(1) : "New"} · {vendor._count.followers} followers</span>
                </div>
              </Link>
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
