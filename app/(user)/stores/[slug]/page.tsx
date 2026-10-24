import {appOrigin} from "@/lib/app-url";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { CalendarDays, MapPin, Package, PackageCheck, ShieldCheck, Star, FileText, Globe2, Info } from "lucide-react";
import { type ProductCardData } from "@/components/user/ProductCard";
import { StoreCatalog } from "@/components/user/StoreCatalog";
import styles from "@/components/user/StoreProfile.module.css";
import { StoreFollowButton } from "@/components/user/StoreFollowButton";
import { CopyStoreLink } from "@/components/user/CopyStoreLink";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { generateUniqueStoreSlug } from "@/lib/store-slug";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/serialize";
import { getCustomerSession } from "@/lib/sessions";
import { pickReviewStat, reviewStatsForProductIds } from "@/lib/review-stats";
import { vendorReviewStatsService } from "@/lib/vendor-review-stats-service";

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
  // Printed QR URLs use immutable vendor IDs. Resolve these before editable slugs.
  const byId = await prisma.vendor.findUnique({ where: { id: param }, select: { ...STORE_SELECT, status: true } });
  if (byId) return byId.status === "approved" ? byId : null;
  const bySlug = await prisma.vendor.findFirst({ where: { storeSlug: param, status: "approved" }, select: STORE_SELECT });
  if (bySlug) return bySlug;

  // Old slug -> alias -> current vendor (may have re-slugged since).
  const alias = await prisma.storeSlugAlias.findUnique({ where: { slug: param }, select: { vendorId: true } });
  if (alias) {
    const vendor = await prisma.vendor.findFirst({ where: { id: alias.vendorId, status: "approved" }, select: STORE_SELECT });
    if (vendor) return vendor;
  }

  return null;
}

function canonicalOrigin() {
  const configured = appOrigin();
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

  const [products, session, storeRatings] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, vendorPublication: { vendorId: vendor.id, status: "active" } },
      select: catalogProductSelect(),
      orderBy: { createdAt: "desc" },
    }),
    getCustomerSession(),
    vendorReviewStatsService([vendor.id]),
  ]);

  const following =
    session?.user?.role === "customer" && session.user.id
      ? (await prisma.storeFollow.count({ where: { customerId: session.user.id, vendorId: vendor.id } })) > 0
      : false;

  const productRatings = await reviewStatsForProductIds(
    products.map((product) => product.id)
  );
  const cards = products.map((product) => ({
    ...(serializeProduct(product) as ProductCardData),
    ...pickReviewStat(productRatings, product.id),
  }));
  const serviceCities = Array.isArray(vendor.serviceCities) ? (vendor.serviceCities as unknown[]).filter((c): c is string => typeof c === "string") : [];
  const storeRating = storeRatings.get(vendor.id) ?? {
    ratingAvg: 0,
    reviewCount: 0,
  };
  const origin = canonicalOrigin();
  const shareableUrl = `${origin ?? ""}/stores/${vendor.storeSlug || vendor.id}`;

  return (
    <main className={styles.page}>
      <section className={styles.profile} aria-label="Store profile">
        {vendor.storeBanner && <div className={styles.banner}><Image src={vendor.storeBanner} alt="" fill unoptimized sizes="(max-width: 767px) 100vw, 1280px" className="object-cover" /></div>}
        <div className={`${styles.identity} ${vendor.storeBanner ? styles.withBanner : ""}`}>
          {vendor.shopLogo ? <span className={styles.avatar}><Image src={vendor.shopLogo} alt={`${vendor.shopName} logo`} fill unoptimized sizes="(max-width: 767px) 80px, 112px" className="object-cover" /></span> : <span className={`${styles.avatar} ${styles.initials}`}>{vendor.shopName.slice(0, 2).toUpperCase()}</span>}
          <div className={styles.identityCopy}>
            <span className={styles.approved}><ShieldCheck aria-hidden="true"/>Approved seller</span>
            <h1>{vendor.shopName}</h1>
            <p className={styles.category}>{vendor.primaryCategory}</p>
            {vendor.shopDescription && <p className={styles.description}>{vendor.shopDescription}</p>}
            <div className={styles.meta}>
              {vendor.city && <span><MapPin aria-hidden="true"/>{vendor.city}</span>}
              <span><CalendarDays aria-hidden="true"/>Selling since {vendor.createdAt.getFullYear()}</span>
            </div>
          </div>
          <div className={styles.actions}>
            <CopyStoreLink url={shareableUrl} title={vendor.shopName}/>
            <StoreFollowButton vendorId={vendor.id} initialFollowing={following} initialFollowers={vendor._count.followers} className={styles.follow}/>
          </div>
        </div>
        <div className={styles.stats}>
          <div><Package aria-hidden="true"/><span><strong>{cards.length}</strong><small>Products</small></span></div>
          <div><PackageCheck aria-hidden="true"/><span><strong>{vendor.vendorShopOrders.length}</strong><small>Delivered orders</small></span></div>
          <div><Star aria-hidden="true"/><span><strong>{storeRating.reviewCount ? storeRating.ratingAvg.toFixed(1) : "?"}</strong><small>{storeRating.reviewCount ? `${storeRating.reviewCount} verified reviews` : "No verified reviews yet"}</small></span></div>
          <div><CalendarDays aria-hidden="true"/><span><strong>{vendor.createdAt.getFullYear()}</strong><small>Selling since</small></span></div>
        </div>
      </section>
      <nav className={styles.navigation} aria-label="Store sections">
        <a href="#store-products" className={styles.productsLink}>Products</a>
        <a href="#store-about">About</a>
        {serviceCities.length > 0 && <a href="#store-coverage">Service coverage</a>}
        {vendor.storePolicies && <a href="#store-policies">Store Policies</a>}
      </nav>
      <StoreCatalog key={vendor.id} products={cards}/>
      <div className={styles.information}>
        <section id="store-about" className={styles.infoCard}>
          <h2><Info aria-hidden="true"/>About this store</h2>
          <p>{vendor.shopDescription || "This seller hasn't added a store description yet."}</p>
          {vendor.primaryCategory && <p className={styles.aboutCategory}>{vendor.primaryCategory}</p>}
        </section>
        {serviceCities.length > 0 && <section id="store-coverage" className={styles.infoCard}>
          <h2><Globe2 aria-hidden="true"/>Service coverage</h2>
          <div className={styles.cities}>{serviceCities.map(city => <span key={city}>{city}</span>)}</div>
        </section>}
        {vendor.storePolicies && <section id="store-policies" className={styles.infoCard}>
          <h2><FileText aria-hidden="true"/>Store policies</h2><p>{vendor.storePolicies}</p>
        </section>}
      </div>
    </main>
  );
}
