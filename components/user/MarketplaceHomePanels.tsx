import Link from "next/link";
import Image from "next/image";
import { wantTrendService } from "@/lib/want-trend-service";
import { activePromotions, publicStores, storeHref } from "@/lib/store-service";
import { WantCard } from "./WantCard";
import { StoreCard } from "./StoreCard";
import { StoreFollowButton } from "./StoreFollowButton";
export async function MarketplaceHomePanels() {
  const [wants, stores] = await Promise.allSettled([wantTrendService(), publicStores()]);
  return <><section id="trending-wants" className="rounded-2xl border bg-white p-4"><h2 className="mb-4 text-xl font-bold">Trending Wants</h2><div className="space-y-3">{wants.status === "fulfilled" ? wants.value.length ? wants.value.slice(0,3).map(w => <WantCard key={w.id} want={w} />) : <p className="text-sm">No open Wants yet.</p> : <p className="text-sm">Wants are temporarily unavailable.</p>}</div><Link href="/wants/trending" className="mt-4 block font-bold text-brand-link">Explore Wants →</Link></section><section id="stores" className="rounded-2xl border bg-white p-4"><h2 className="mb-2 text-xl font-bold">Top Stores</h2><p className="mb-4 text-xs text-gray-600">Approved stores ordered by real followers.</p><div className="space-y-3">{stores.status === "fulfilled" ? stores.value.length ? stores.value.slice(0,3).map(s => <StoreCard key={s.id} store={s} />) : <p className="text-sm">No public stores yet.</p> : <p className="text-sm">Stores are temporarily unavailable.</p>}</div><Link href="/stores" className="mt-4 block font-bold text-brand-link">Browse stores →</Link></section></>;
}
export async function VendorSpotlight() {
  let campaigns: Awaited<ReturnType<typeof activePromotions>>;
  try { campaigns = await activePromotions(); } catch { return null; }
  if (!campaigns.length) return null;
  return <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6"><h2 className="mb-4 text-2xl font-bold">Vendor Spotlight</h2><div className="grid gap-4 md:grid-cols-2">{campaigns.map(c => <article key={c.id} className="overflow-hidden rounded-2xl border bg-white"><Link href={storeHref(c.vendor)}>{c.desktopImage && <Image src={c.desktopImage} alt={c.title} width={1000} height={400} unoptimized className={`${c.mobileImage ? "hidden sm:block" : "block"} h-48 w-full object-cover`} />}{c.mobileImage && <Image src={c.mobileImage} alt={c.title} width={600} height={400} unoptimized className="h-48 w-full object-cover sm:hidden" />}</Link><div className="p-5"><p className="text-xs font-bold text-brand-link">{c.isSponsored ? "Sponsored" : "Featured Store"}</p><h3 className="mt-2 text-xl font-bold">{c.title}</h3><p className="my-2">{c.subtitle}</p><Link href={storeHref(c.vendor)} className="mb-4 block font-bold text-brand-link">{c.ctaText} · {c.vendor.shopName} →</Link><StoreFollowButton vendorId={c.vendor.id} initialCount={c.vendor._count.storeFollows} /></div></article>)}</div></section>;
}