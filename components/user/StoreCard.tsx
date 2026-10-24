import Link from "@/components/ui/LoadingLink";
import Image from "next/image";
import { MapPin, PackageCheck, Package, Star, ShieldCheck } from "lucide-react";
import { StoreFollowButton } from "./StoreFollowButton";
import styles from "./StoreDirectory.module.css";

export type PublicStore = {
  id: string;
  shopName: string;
  storeSlug: string | null;
  shopLogo?: string | null;
  storeBanner?: string | null;
  primaryCategory: string;
  shopDescription: string | null;
  city?: string;
  rating?: number | null;
  ratingCount?: number;
  deliveredCount?: number;
  initialFollowing?: boolean;
  _count: { followers: number; products?: number };
};

// The directory selects approved vendors only.
export function StoreCard({ store }: { store: PublicStore }) {
  const href = `/stores/${encodeURIComponent(store.storeSlug || store.id)}`;
  return <article className={styles.card}>
    <Link href={href} className={styles.cover} aria-label={`Visit ${store.shopName}`}>
      {store.storeBanner || store.shopLogo ? <Image src={(store.storeBanner || store.shopLogo)!} alt="" fill unoptimized sizes="(max-width: 767px) 64px, 320px" className="object-cover"/> : <span className={styles.coverInitials}>{store.shopName.slice(0, 2).toUpperCase()}</span>}
    </Link>
    <div className={styles.cardBody}>
      <Link href={href} className={styles.identity}>
        <span className={styles.avatar}>{store.shopLogo ? <Image src={store.shopLogo} alt="" fill unoptimized sizes="40px" className="object-cover"/> : store.shopName.slice(0, 2).toUpperCase()}</span>
        <span className={styles.identityText}><span className={styles.approved}><ShieldCheck size={12}/> Approved seller</span><h2>{store.shopName}</h2><span className={styles.category}>{store.primaryCategory}</span></span>
      </Link>
      {store.shopDescription && <Link href={href} className={styles.description}>{store.shopDescription}</Link>}
      <div className={styles.stats}>
        {store.city && <span className={styles.fullStat}><MapPin size={13}/>{store.city}</span>}
        {typeof store._count.products === "number" && <span><Package size={13}/>{store._count.products} products</span>}
        {typeof store.deliveredCount === "number" && <span><PackageCheck size={13}/>{store.deliveredCount} delivered</span>}
        <span className={styles.fullStat}><Star size={13}/>{store.ratingCount && store.rating != null ? `${store.rating.toFixed(1)} (${store.ratingCount} verified reviews)` : "No verified reviews yet"}</span>
      </div>
      <div className={styles.follow}><StoreFollowButton vendorId={store.id} initialFollowing={store.initialFollowing} initialFollowers={store._count.followers} className={styles.followButton}/></div>
    </div>
  </article>;
}
