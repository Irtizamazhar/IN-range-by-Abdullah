"use client";

import { useMemo, useState } from "react";
import { Eye, MapPin, Package, Users } from "lucide-react";
import Link from "@/components/ui/LoadingLink";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { ContainedImage } from "@/components/user/ContainedImage";
import { demandBudget, demandType, MatchBadge, ReasonChips, TypePill } from "./DemandBits";

export type DemandItem = {
  id: string; title: string; requestType: string; city: string; quantity: number; joined: number; images: string[];
  budgetMin: number | null; budgetMax: number | null; budgetFlexible: boolean; score: number; reasons: string[];
};

const SAME_CITY = "Same city as your store";
const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "PRODUCT", label: "Products", test: (d: DemandItem) => d.requestType === "PRODUCT" },
  { id: "SERVICE", label: "Services", test: (d: DemandItem) => d.requestType === "SERVICE" },
  { id: "GIFT", label: "Gifts", test: (d: DemandItem) => d.requestType === "GIFT" },
  { id: "city", label: "Same city", test: (d: DemandItem) => d.reasons.includes(SAME_CITY) },
] as const;
/** Content pane widths (sidebar excluded): 2 cards from 480px, then 3 / 4 / 6 at lg / xl / 2xl. */
export const DEMAND_GRID = "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6";
const GRID = DEMAND_GRID;
const SIZES = "(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 480px) 45vw, 100vw";
// Lift only where a real pointer hovers; touch gets a light press instead.
const hover = "[@media(hover:hover)]:hover:-translate-y-[3px] [@media(hover:hover)]:hover:border-emerald-500 active:scale-[0.99]";

function DemandCard({ item, onView }: { item: DemandItem; onView: () => void }) {
  const href = `/vendor/dashboard/demand/${item.id}`;
  const type = demandType(item.requestType);
  return <article className={`group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#D9E6D0] bg-white transition duration-200 ${hover}`}>
    <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-t-2xl bg-[#F4F8EF]">
      <ContainedImage src={item.images[0]} sizes={SIZES} fallback={<span className="flex h-14 w-14 items-center justify-center rounded-full bg-lime-100 text-emerald-700"><type.Icon className="h-7 w-7" aria-hidden="true" /></span>} />
      <TypePill requestType={item.requestType} className="absolute left-2 top-2" />
      <MatchBadge score={item.score} className="absolute right-2 top-2" />
      {item.images.length > 1 && <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">+{item.images.length - 1}</span>}
      {item.images.length > 0 && <button type="button" onClick={event => { event.stopPropagation(); event.preventDefault(); onView(); }} aria-label={`View images for ${item.title}`}
        className="absolute bottom-2.5 right-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-emerald-950 shadow hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />View</button>}
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
      {/* The title link stretches over the whole card; the View pill and button sit above it. */}
      <h3 className="truncate text-sm font-medium text-emerald-950" title={item.title}><Link href={href} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline">{item.title}</Link></h3>
      <p className="truncate text-[12.5px] font-medium text-emerald-700">{demandBudget(item)}</p>
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-gray-500">
        <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{item.city}</span></span>
        <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" aria-hidden="true" />Qty {item.quantity.toLocaleString("en-PK")}</span>
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{item.joined} joined</span>
      </p>
      <div className="mt-0.5"><ReasonChips reasons={item.reasons} max={2} /></div>
      <div className="mt-auto pt-2">
        <Link href={href} className="relative z-10 flex h-10 w-full items-center justify-center whitespace-nowrap rounded-lg bg-brand-primary px-2 text-[12.5px] font-semibold text-brand-dark transition hover:brightness-95 active:scale-[0.98]">View & submit offer</Link>
      </div>
    </div>
  </article>;
}

export function DemandCardSkeleton() {
  return <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#D9E6D0] bg-white" aria-hidden="true">
    <div className="aspect-[4/3] animate-pulse bg-[#F4F8EF]" />
    <div className="flex flex-1 flex-col gap-2 p-3">
      <span className="h-4 w-3/4 animate-pulse rounded bg-neutral-100" /><span className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
      <span className="h-3 w-2/3 animate-pulse rounded bg-neutral-100" /><span className="mt-auto h-10 w-full animate-pulse rounded-lg bg-neutral-100" />
    </div>
  </div>;
}

/** Vendor "Customer demand" list: client-side type/city filters over the already-loaded matches. */
export function DemandBoard({ matching, others }: { matching: DemandItem[]; others: DemandItem[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [viewing, setViewing] = useState<DemandItem | null>(null);
  const test = FILTERS.find(f => f.id === filter)!.test;
  const [shownMatching, shownOthers] = useMemo(() => [matching.filter(test), others.filter(test)], [matching, others, test]);
  const empty = <div className="rounded-2xl border border-dashed border-[#D9E6D0] bg-white px-6 py-10 text-center text-sm text-gray-600">No matching demand yet. Check back soon or update your store category and city.</div>;

  return <>
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter demand">
      {FILTERS.map(f => <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
        className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${filter === f.id ? "border-emerald-800 bg-emerald-800 text-white" : "border-[#D9E6D0] bg-white text-emerald-900 hover:border-emerald-500"}`}>{f.label}</button>)}
    </div>
    <h2 className="mb-3 text-lg font-bold text-emerald-950">Matching for you</h2>
    {shownMatching.length ? <div className={GRID}>{shownMatching.map(item => <DemandCard key={item.id} item={item} onView={() => setViewing(item)} />)}</div> : empty}
    {others.length > 0 && <>
      <h2 className="mb-3 mt-8 text-lg font-bold text-emerald-950">All open demand</h2>
      {shownOthers.length ? <div className={GRID}>{shownOthers.map(item => <DemandCard key={item.id} item={item} onView={() => setViewing(item)} />)}</div> : <p className="text-sm text-gray-500">Nothing here for this filter.</p>}
    </>}
    {viewing && <ImageLightbox images={viewing.images} title={viewing.title} onClose={() => setViewing(null)} />}
  </>;
}
