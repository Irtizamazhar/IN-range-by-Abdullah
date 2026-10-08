import Link from "@/components/ui/LoadingLink";
import {
  ArrowRight, CarFront, Flame, Laptop, MapPin, PackageSearch,
  Shirt, Sofa, Sparkles, Store, TrendingUp,
} from "lucide-react";
import { ProductCard, ProductCardSkeleton, type ProductCardData } from "./ProductCard";
import styles from "./HomeMarketplace.module.css";

type MarketplaceWant = {
  id: string;
  title: string;
  city: string;
  _count: { offers: number };
};

type MarketplaceStore = {
  id: string;
  shopName: string;
  storeSlug: string | null;
  primaryCategory: string | null;
  label: string | null;
  rating: { ratingAvg: number; reviewCount: number };
};

function wantIcon(title: string) {
  if (/\b(car|auto|vehicle|bike|motor)\b/i.test(title)) return CarFront;
  if (/\b(laptop|computer|charger|phone|mobile|tablet)\b/i.test(title)) return Laptop;
  if (/\b(sofa|chair|furniture|couch|bed)\b/i.test(title)) return Sofa;
  if (/\b(shirt|dress|clothes|clothing|jacket)\b/i.test(title)) return Shirt;
  return PackageSearch;
}

function storeInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : name.slice(0, 2)).toUpperCase();
}

export function HomeMarketplace({ products, wants, stores }: {
  products: ProductCardData[];
  wants: MarketplaceWant[];
  stores: MarketplaceStore[];
}) {
  return (
    <section data-home-marketplace className={styles.marketplace} aria-label="Explore the JORO marketplace">
      <section data-marketplace-panel="products" className={`${styles.panel} ${styles.featured}`} aria-labelledby="featured-products-heading">
        <header className={styles.featuredHeader}>
          <div className={styles.headingGroup}>
            <p className={styles.eyebrow}>
              <span className={styles.sparkle}><Sparkles aria-hidden="true" /></span>
              Popular Picks
            </p>
            <h2 id="featured-products-heading" className={styles.featuredTitle}>Featured Products</h2>
          </div>
          <Link href="/products" className={styles.viewAll}>View All <ArrowRight aria-hidden="true" /></Link>
        </header>
        <div className={styles.products}>
          {products.length
            ? products.slice(0, 4).map((product) => <ProductCard key={product._id} product={product} variant="marketplace" />)
            : Array.from({ length: 4 }, (_, index) => <ProductCardSkeleton key={index} variant="marketplace" />)}
        </div>
      </section>

      <section id="trending-wants" data-marketplace-panel="wants" className={`${styles.panel} ${styles.wants}`} aria-labelledby="trending-wants-heading">
        <header className={styles.sideHeader}>
          <p className={styles.eyebrow}><TrendingUp aria-hidden="true" /> What People Need</p>
          <h2 id="trending-wants-heading" className={styles.sideTitle}>Trending Wants <Flame aria-hidden="true" className={styles.flame} /></h2>
        </header>
        <div className={styles.wantList}>
          {wants.length ? wants.map((want) => {
            const Icon = wantIcon(want.title);
            return (
              <Link key={want.id} href={`/wants/${want.id}`} className={styles.want}>
                <span className={styles.wantIcon}><Icon aria-hidden="true" /></span>
                <div className={styles.wantInfo}>
                  <h3 className={styles.wantTitle}>{want.title}</h3>
                  <div className={styles.wantMeta}>
                    <span className={styles.city}><MapPin aria-hidden="true" />{want.city}</span>
                    <span aria-hidden="true">·</span>
                    <span>{want._count.offers} {want._count.offers === 1 ? "offer" : "offers"}</span>
                  </div>
                </div>
                <span className={styles.open}>Open</span>
              </Link>
            );
          }) : <p className={styles.empty}>No moderated Wants yet.</p>}
        </div>
        <Link href="/wants" className={`${styles.cta} ${styles.explore}`}>Explore Wants <ArrowRight aria-hidden="true" /></Link>
      </section>

      <section id="stores" data-marketplace-panel="vendors" className={`${styles.panel} ${styles.vendors}`} aria-labelledby="top-vendors-heading">
        <header className={styles.sideHeader}>
          <p className={styles.eyebrow}><Store aria-hidden="true" /> Seller Network</p>
          <h2 id="top-vendors-heading" className={styles.sideTitle}>Top Vendors</h2>
          <p className={styles.description}>Discover trusted stores selected on JORO</p>
        </header>
        <div className={styles.storeList}>
          {stores.length ? stores.map((store) => (
            <Link key={store.id} href={`/stores/${store.storeSlug || store.id}`} className={styles.store}>
              <span className={styles.avatar} aria-hidden="true">{storeInitials(store.shopName)}</span>
              <div className={styles.storeInfo}>
                <h3 className={styles.storeTitle}>{store.shopName}</h3>
                <p className={styles.storeCategory}>{store.primaryCategory}</p>
                {store.rating.reviewCount > 0 && <p className={styles.storeRating}>★ {store.rating.ratingAvg.toFixed(1)} ({store.rating.reviewCount})</p>}
              </div>
              <span className={styles.vendorBadge}>{store.label || "Top Vendor"}</span>
            </Link>
          )) : <p className={styles.empty}>No Top Vendors selected yet.</p>}
        </div>
        <Link href="/stores" className={`${styles.cta} ${styles.browse}`}>Browse Stores <ArrowRight aria-hidden="true" /></Link>
      </section>
    </section>
  );
}
