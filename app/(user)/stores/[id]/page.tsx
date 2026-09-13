import { notFound } from "next/navigation";
import { MapPin, PackageCheck, ShieldCheck, Star } from "lucide-react";
import { ProductCard, type ProductCardData } from "@/components/user/ProductCard";
import { StoreFollowButton } from "@/components/user/StoreFollowButton";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/serialize";
import { getCustomerSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: { id: string } }) {
  const [vendor, products, session] = await Promise.all([
    prisma.vendor.findFirst({
      where: { id: params.id, status: "approved" },
      select: {
        id: true,
        shopName: true,
        shopDescription: true,
        primaryCategory: true,
        city: true,
        createdAt: true,
        _count: { select: { followers: true } },
        reviews: { where: { isVisible: true }, select: { rating: true } },
        vendorShopOrders: { where: { status: "delivered" }, select: { id: true } },
      },
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        vendorPublication: { vendorId: params.id, status: "active" },
      },
      select: catalogProductSelect(),
      orderBy: { createdAt: "desc" },
    }),
    getCustomerSession(),
  ]);
  if (!vendor) notFound();

  const following =
    session?.user?.role === "customer" && session.user.id
      ? (await prisma.storeFollow.count({
          where: { customerId: session.user.id, vendorId: vendor.id },
        })) > 0
      : false;
  const rating = vendor.reviews.length
    ? vendor.reviews.reduce((sum, review) => sum + review.rating, 0) / vendor.reviews.length
    : null;
  const cards = products.map((product) => serializeProduct(product) as ProductCardData);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="overflow-hidden rounded-[24px] bg-brand-dark text-white shadow-panel">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-brand-primary">
              <ShieldCheck className="h-5 w-5" /> Approved seller
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{vendor.shopName}</h1>
            <p className="mt-1 text-sm font-semibold text-white/65">{vendor.primaryCategory}</p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">
              {vendor.shopDescription || "Browse products from this approved marketplace seller."}
            </p>
          </div>
          <StoreFollowButton
            vendorId={vendor.id}
            initialFollowing={following}
            initialFollowers={vendor._count.followers}
          />
        </div>
        <div className="grid grid-cols-2 border-t border-white/10 bg-white/[0.04] sm:grid-cols-4">
          <span className="flex items-center gap-2 p-4 text-sm"><MapPin className="h-4 w-4 text-brand-primary" />{vendor.city}</span>
          <span className="flex items-center gap-2 p-4 text-sm"><PackageCheck className="h-4 w-4 text-brand-primary" />{vendor.vendorShopOrders.length} delivered</span>
          <span className="flex items-center gap-2 p-4 text-sm"><Star className="h-4 w-4 text-brand-primary" />{rating ? rating.toFixed(1) : "New"} rating</span>
          <span className="p-4 text-sm">Selling since {vendor.createdAt.getFullYear()}</span>
        </div>
      </section>

      <section className="py-9">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-brand-link">Store catalog</p>
            <h2 className="text-2xl font-black text-brand-dark">Available products</h2>
          </div>
          <span className="text-sm font-semibold text-darkText/50">{cards.length} items</span>
        </div>
        {cards.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {cards.map((product) => <ProductCard key={product._id} product={product} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-borderGray bg-white p-10 text-center text-darkText/60">
            This store has no active products right now.
          </div>
        )}
      </section>
    </main>
  );
}
