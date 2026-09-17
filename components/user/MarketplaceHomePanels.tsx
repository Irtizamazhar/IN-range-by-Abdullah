import Link from "next/link";
import Image from "next/image";
import { activePromotions, promotionHref } from "@/lib/store-service";
import { StoreFollowButton } from "./StoreFollowButton";
export async function VendorSpotlight() {
  let campaigns: Awaited<ReturnType<typeof activePromotions>>;
  try { campaigns = await activePromotions(); } catch { return null; }
  if (!campaigns.length) return null;
  return <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6"><h2 className="mb-1 text-2xl font-bold">Vendor Spotlight</h2><p className="mb-4 text-sm text-gray-600">Sponsored placements from JORO partners.</p><div className="grid gap-4 md:grid-cols-2">{campaigns.map(c => { const href = promotionHref(c); return <article key={c.id} className={`overflow-hidden rounded-2xl border bg-white ${c.placement === "HOMEPAGE_BANNER" ? "md:col-span-2" : ""}`}><Link href={href}>{c.desktopImage && <Image src={c.desktopImage} alt={c.title} width={1000} height={400} unoptimized className={`${c.mobileImage ? "hidden sm:block" : "block"} h-48 w-full object-cover`} />}{c.mobileImage && <Image src={c.mobileImage} alt={c.title} width={600} height={400} unoptimized className="h-48 w-full object-cover sm:hidden" />}</Link><div className="p-5"><p className="text-xs font-bold text-brand-link">{c.isSponsored ? "Sponsored" : "Featured Partner"}</p><h3 className="mt-2 text-xl font-bold">{c.title}</h3><p className="my-2">{c.subtitle}</p><Link href={href} className="mb-4 block font-bold text-brand-link">{c.ctaText} · {c.vendor.shopName} →</Link><StoreFollowButton vendorId={c.vendor.id} initialFollowers={c.vendor._count.followers} /></div></article>; })}</div></section>;
}
