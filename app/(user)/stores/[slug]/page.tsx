import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { MapPin, PackageCheck, ShieldCheck, Star, FileText, Globe2 } from "lucide-react";
import { ProductCard, type ProductCardData } from "@/components/user/ProductCard";
import { StoreFollowButton } from "@/components/user/StoreFollowButton";
import { CopyStoreLink } from "@/components/user/CopyStoreLink";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { generateUniqueStoreSlug } from "@/lib/store-slug";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/serialize";
import { getCustomerSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const STORE_SELECT = {
  id: true,
  shopName: true,
  shopDescription: true,
  primaryCategory: true,
  city: true,
  createdAt: true,
  storeSlug: true,
  shopLogo: true,
  storeBanner: true,
  storePolicies: true,
  serviceCities: true,
  _count: { select: { followers: true } },
  vendorShopOrders: { where: { status: "delivered" as const }, select: { id: true } },
} as const;

async function resolveVendor(param: string) {
  const bySlug = await prisma.vendor.findFirst({ where: { storeSlug: param, status: "approved" }, select: STORE_SELECT });
  if (bySlug) return bySlug;

  // Old slug -> alias -> current vendor (may have re-slugged since).
  const alias = await prisma.storeSlugAlias.findUnique({ where: { slug: param }, select: { vendorId: true } });
  if (alias) {
    const vendor = await prisma.vendor.findFirst({ where: { id: alias.vendorId, status: "approved" }, select: STORE_SELECT });
    if (vendor) return vendor;
  }

  // Backward-compat: raw vendor id (pre-slug bookmarks/printed material).
  return prisma.vendor.findFirst({ where: { id: param, status: "approved" }, select: STORE_SELECT });
}

function canonicalOrigin() {
  const configured = process.env.CANONICAL_HOST || process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const url = new URL(configured || "");
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export default async function StorePage({ params }: { params: { slug: string } }) {
  const found = await resolveVendor(params.slug);
  if (!found) notFound();
  let vendor = found;

  // Lazily backfill a slug for any vendor approved before slugs became mandatory.
  if (!vendor.storeSlug) {
    const slug = await generateUniqueStoreSlug(prisma, vendor.shopName, vendor.id);
    const backfilled = await prisma.vendor
      .update({ where: { id: vendor.id }, data: { storeSlug: slug }, select: STORE_SELECT })
      .catch(() => null);
    if (backfilled) vendor = backfilled;
  }

  if (vendor.storeSlug && vendor.storeSlug !== params.slug) {
    redirect(`/stores/${vendor.storeSlug}`);
  }

  const [products, session, ratingAgg] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, vendorPublication: { vendorId: vendor.id, status: "active" } },
      select: catalogProductSelect(),
      orderBy: { createdAt: "desc" },
    }),
    getCustomerSession(),
    prisma.vendorReview.aggregate({ where: { vendorId: vendor.id, isVisible: true }, _avg: { rating: true }, _count: { rating: true } }),
  ]);

  const following =
    session?.user?.role === "customer" && session.user.id
      ? (await prisma.storeFollow.count({ where: { customerId: session.user.id, vendorId: vendor.id } })) > 0
      : false;

  const cards = products.map((product) => serializeProduct(product) as ProductCardData);
  const serviceCities = Array.isArray(vendor.serviceCities) ? (vendor.serviceCities as unknown[]).filter((c): c is string => typeof c === "string") : [];
  const rating = ratingAgg._count.rating > 0 ? Number(ratingAgg._avg.rating) : null;
  const origin = canonicalOrigin();
  const shareableUrl = `${origin ?? ""}/stores/${vendor.storeSlug}`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="overflow-hidden rounded-[24px] bg-brand-dark text-white shadow-panel">
        {vendor.storeBanner ? (
          <div className="relative h-36 w-full sm:h-48">
            <Image src={vendor.storeBanner} alt="" fill unoptimized className="object-cover opacity-80" />
          </div>
        ) : null}
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="flex min-w-0 gap-4">
            {vendor.shopLogo ? (
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                <Image src={vendor.shopLogo} alt={`${vendor.shopName} logo`} fill unoptimized className="object-cover" />
              </span>
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-primary text-lg font-black text-brand-dark">
                {vendor.shopName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold text-brand-primary">
                <ShieldCheck className="h-5 w-5" /> Approved seller
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight">{vendor.shopName}</h1>
              <p className="mt-1 text-sm font-semibold text-white/65">{vendor.primaryCategory}</p>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">
                {vendor.shopDescription || "This seller hasn't added a store description yet."}
              </p>
              <div className="mt-4">
                <CopyStoreLink url={shareableUrl} />
              </div>
            </div>
          </div>
          <StoreFollowButton vendorId={vendor.id} initialFollowing={following} initialFollowers={vendor._count.followers} />
        </div>
        <div className="grid grid-cols-2 border-t border-white/10 bg-white/[0.04] sm:grid-cols-4">
          <span className="flex items-center gap-2 p-4 text-sm"><MapPin className="h-4 w-4 text-brand-primary" />{vendor.city}</span>
          <span className="flex items-center gap-2 p-4 text-sm"><PackageCheck className="h-4 w-4 text-brand-primary" />{vendor.vendorShopOrders.length} delivered</span>
          <span className="flex items-center gap-2 p-4 text-sm">
            <Star className="h-4 w-4 text-brand-primary" />
            {rating ? `${rating.toFixed(1)} (${ratingAgg._count.rating})` : "No reviews yet"}
          </span>
          <span className="p-4 text-sm">Selling since {vendor.createdAt.getFullYear()}</span>
        </div>
      </section>

      {serviceCities.length ? (
        <section className="mt-6 rounded-2xl border border-borderGray bg-white p-5">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-brand-link"><Globe2 className="h-4 w-4" /> Service coverage</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {serviceCities.map((city) => (
              <span key={city} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-link">{city}</span>
            ))}
          </div>
        </section>
      ) : null}

      {vendor.storePolicies ? (
        <section className="mt-6 rounded-2xl border border-borderGray bg-white p-5">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-brand-link"><FileText className="h-4 w-4" /> Store policies</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-darkText/70">{vendor.storePolicies}</p>
        </section>
      ) : null}

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
