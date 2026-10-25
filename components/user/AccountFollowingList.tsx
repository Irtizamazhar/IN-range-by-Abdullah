"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ChevronDown, Search, Store, Users } from "lucide-react";

export type FollowedStore = { id: string; shopName: string; shopLogo: string | null; storeSlug: string | null; primaryCategory: string; city: string; status: string; _count: { followers: number } };

const SORTS = { recent: "Recently followed", oldest: "Oldest followed", name: "Store name (A–Z)", followers: "Most followers" } as const;
type Sort = keyof typeof SORTS;
/** Older store fields were saved HTML-escaped ("Hangers &amp; Hooks"); show the plain text. React escapes it again on render. */
const plain = (value: string) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#0?39;/g, "'");
const button = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link sm:text-sm";

/**
 * The Following tab: heading with a sort control, then the followed stores (newest follow first, as the API returns
 * them) or the empty state. The list is complete, so sorting happens here without another request.
 */
export function FollowingSection({ stores, onUnfollow }: { stores: FollowedStore[]; onUnfollow: (id: string) => Promise<unknown> }) {
  const [sort, setSort] = useState<Sort>("recent");
  const sorted = useMemo(() => {
    if (sort === "oldest") return [...stores].reverse();
    if (sort === "name") return [...stores].sort((a, b) => plain(a.shopName).localeCompare(plain(b.shopName)));
    if (sort === "followers") return [...stores].sort((a, b) => b._count.followers - a._count.followers);
    return stores;
  }, [stores, sort]);

  return <>
    <header className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-end sm:justify-between sm:pt-2">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-brand-link sm:text-sm">Your JORO space</p>
        <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-[#005235] sm:text-[30px] lg:text-[32px]">Following</h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-darkText/65 sm:text-[15px]">Stores and sellers you follow. Get updates on new products, deals and offers.</p>
      </div>
      {stores.length > 1 && <label className="flex shrink-0 items-center gap-2 text-[13px] text-darkText/65 sm:text-sm"><span className="shrink-0">Sort by:</span>
        <span className="relative min-w-0 flex-1 sm:flex-none">
          <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="h-10 w-full appearance-none rounded-xl border border-[#DFEDE5] bg-white py-0 pl-3.5 pr-9 text-[13px] font-semibold text-brand-dark focus:border-brand-link focus:outline-none focus:ring-2 focus:ring-brand-link/20 sm:w-auto sm:text-sm">
            {(Object.keys(SORTS) as Sort[]).map(key => <option key={key} value={key}>{SORTS[key]}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-darkText/60" aria-hidden="true" />
        </span>
      </label>}
    </header>
    <div className="mt-4 sm:mt-5">
      {sorted.length ? <div className="grid gap-3 md:grid-cols-2 lg:gap-4 xl:grid-cols-3">{sorted.map(s => <FollowedStoreCard key={s.id} store={s} onUnfollow={onUnfollow} />)}</div> : <FollowingEmpty />}
    </div>
  </>;
}

function FollowedStoreCard({ store: s, onUnfollow }: { store: FollowedStore; onUnfollow: (id: string) => Promise<unknown> }) {
  const name = plain(s.shopName); const open = s.status === "approved" && !!s.storeSlug; const followers = s._count.followers;
  return <article aria-labelledby={`store-${s.id}`} className="flex gap-3.5 rounded-2xl border border-[#E3ECE6] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,61,43,0.04)] transition hover:border-[#C9E2CF] hover:shadow-[0_6px_20px_rgba(0,61,43,0.07)] sm:gap-4 sm:p-4">
    <span className="relative inline-flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E3ECE6] bg-[#F4F9F0] sm:h-24 sm:w-24">
      {s.shopLogo ? <Image src={s.shopLogo} alt="" fill sizes="96px" unoptimized className="object-cover" /> : <Store className="h-8 w-8 text-[#005235]/40" aria-hidden="true" />}
    </span>
    <div className="flex min-w-0 flex-1 flex-col">
      <h2 id={`store-${s.id}`} className="break-words text-base font-semibold leading-snug text-brand-dark sm:text-[17px]">{name}</h2>
      <p className="mt-0.5 break-words text-[13px] text-darkText/60 sm:text-sm">{plain(s.primaryCategory)} · {plain(s.city)}</p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-darkText/60"><Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{followers.toLocaleString("en-PK")} {followers === 1 ? "follower" : "followers"}</p>
      <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-3">
        {open ? <Link href={`/stores/${encodeURIComponent(s.storeSlug!)}`} className={`${button} border-[#B5DCA0] bg-white text-[#005235] hover:bg-brand-soft`}><Store className="h-4 w-4" aria-hidden="true" />View Store<span className="sr-only"> {name}</span></Link>
          : <span className="mr-auto rounded-lg bg-gray-100 px-3 py-2 text-[13px] font-medium text-darkText/65">Store currently unavailable</span>}
        <LoadingButton onClick={() => onUnfollow(s.id)} aria-label={`Unfollow ${name}`} className={`${button} border-[#005235]/40 bg-white text-[#005235] hover:bg-[#F4F9F0]`}>Unfollow</LoadingButton>
      </div>
    </div>
  </article>;
}

/** Shown only when the customer follows no stores: horizontal on wider screens, stacked on phones. */
function FollowingEmpty() {
  return <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#DFEDE5] bg-gradient-to-b from-[#F4FAEF] to-[#FAFDF7] px-5 py-6 text-center sm:flex-row sm:gap-8 sm:px-8 sm:py-7 sm:text-left lg:rounded-3xl lg:px-12">
    {/* White-background illustration; multiply blends it into the mint panel and the mask fades its edges. */}
    <Image src="/images/account/following-empty.webp" alt="" width={660} height={432} unoptimized priority sizes="(min-width: 640px) 300px, 220px" className="h-auto w-[220px] shrink-0 mix-blend-multiply [mask-image:radial-gradient(ellipse_at_center,#000_62%,transparent_100%)] sm:w-[260px] lg:w-[300px]" />
    <div className="flex min-w-0 flex-1 flex-col items-center sm:items-start">
      <h2 className="text-lg font-semibold text-brand-dark sm:text-xl">You&apos;re not following any stores yet</h2>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-darkText/60 sm:text-[15px]">Follow your favourite stores and sellers to stay updated on their latest products and offers.</p>
      <Link href="/stores" className="mt-5 inline-flex min-h-11 w-full max-w-[280px] items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 text-sm font-semibold text-brand-dark transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link sm:w-auto"><Search className="h-4 w-4" aria-hidden="true" />Discover stores</Link>
    </div>
  </div>;
}
