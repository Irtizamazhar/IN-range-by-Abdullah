import Link from "next/link";
import Image from "next/image";
import { MapPin, PackageCheck, Store as StoreIcon, Star } from "lucide-react";
import { StoreFollowButton } from "./StoreFollowButton";

export type PublicStore = {
  id: string;
  shopName: string;
  storeSlug: string | null;
  shopLogo?: string | null;
  primaryCategory: string;
  shopDescription: string | null;
  city?: string;
  rating?: number | null;
  deliveredCount?: number;
  _count: { followers: number; products?: number };
};

export function StoreCard({ store }: { store: PublicStore }) {
  const href = `/stores/${encodeURIComponent(store.storeSlug || store.id)}`;
  return (
    <article className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-primary/40">
      <Link href={href} className="flex min-w-0 items-start gap-3">
        {store.shopLogo ? (
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-black/[0.06]">
            <Image src={store.shopLogo} alt="" fill unoptimized className="object-cover" />
          </span>
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-primary text-lg font-black text-brand-dark">
            {store.shopName.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-black text-brand-dark">{store.shopName}</h2>
          <p className="text-sm font-semibold text-brand-link">{store.primaryCategory}</p>
        </div>
      </Link>
      <Link href={href}>
        <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-darkText/60">
          {store.shopDescription || "Approved marketplace seller"}
        </p>
      </Link>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-darkText/65">
        {store.city ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{store.city}</span> : null}
        {typeof store.deliveredCount === "number" ? <span className="inline-flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5" />{store.deliveredCount} delivered</span> : null}
        {typeof store._count.products === "number" ? <span className="inline-flex items-center gap-1"><StoreIcon className="h-3.5 w-3.5" />{store._count.products} products</span> : null}
        <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" />{store.rating ? store.rating.toFixed(1) : "New"} · {store._count.followers} followers</span>
      </div>
      <div className="mt-4">
        <StoreFollowButton vendorId={store.id} initialFollowers={store._count.followers} />
      </div>
    </article>
  );
}
