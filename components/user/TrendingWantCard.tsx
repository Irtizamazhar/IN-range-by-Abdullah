"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { Gift, MapPin, Package, Wrench } from "lucide-react";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

export type TrendingWant = {
  id: string; title: string; requestType: string; city: string; photo: string | null; createdAt: Date | string;
  budgetMin: number | null; budgetMax: number | null; budgetFlexible: boolean;
  joined: number; offers: number;
};

const TYPES: Record<string, { label: string; text: string; Icon: typeof Package }> = {
  PRODUCT: { label: "Product", text: "text-emerald-700", Icon: Package },
  SERVICE: { label: "Service", text: "text-sky-700", Icon: Wrench },
  GIFT: { label: "Gift", text: "text-rose-600", Icon: Gift },
};
const DAY_MS = 24 * 60 * 60 * 1000;
const pkr = (value: number) => value.toLocaleString("en-PK", { maximumFractionDigits: 0 });

function budgetLabel(want: TrendingWant) {
  const min = want.budgetMin ?? 0, max = want.budgetMax ?? 0;
  if (want.budgetFlexible || (!min && !max)) return "Flexible";
  if (!max || min === max) return `PKR ${pkr(max || min)}`;
  return min ? `PKR ${pkr(min)} – ${pkr(max)}` : `Up to PKR ${pkr(max)}`;
}

/** "Hot" (3+ joined) wins over "New" (posted in the last 24 hours); otherwise no tag. */
function highlight(want: TrendingWant) {
  if (want.joined >= 3) return { label: "Hot", className: "bg-red-50 text-red-600" };
  if (Date.now() - new Date(want.createdAt).getTime() < DAY_MS) return { label: "New", className: "bg-lime-100 text-emerald-800" };
  return null;
}

/** Compact Want card for the home "Trending Wants" grid; the whole card links to the Want. */
export function TrendingWantCard({ want }: { want: TrendingWant }) {
  const [failed, setFailed] = useState(false);
  const type = TYPES[want.requestType] || TYPES.PRODUCT;
  const tag = highlight(want);
  const showImage = want.photo && !failed;

  return <Link href={`/wants/${want.id}`} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[#D9E6D0] bg-white transition duration-200 hover:-translate-y-[3px] hover:border-emerald-500 focus-visible:-translate-y-[3px] focus-visible:border-emerald-600 focus-visible:outline-none">
    <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-t-xl bg-[#F4F8EF]">
      {/* Below lg the top padding clears the type/"Hot" badges so tall logos are never covered. */}
      <div className="absolute inset-0 flex items-center justify-center p-2 pt-7 sm:pt-8 lg:pt-2">
        {/* Natural size, capped to the box: every image is shown whole and small ones are never enlarged. */}
        {showImage
          ? <Image src={want.photo!} alt="" width={480} height={360} loading="lazy" sizes="(min-width: 1280px) 200px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" unoptimized={shouldUnoptimizeImageSrc(want.photo!)} onError={() => setFailed(true)} className="block h-auto max-h-full w-auto max-w-full object-contain" />
          : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime-100 text-emerald-700"><type.Icon className="h-6 w-6" aria-hidden="true" /></span>}
      </div>
      <span className={`absolute left-1.5 top-1.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] sm:left-2 sm:top-2 sm:px-2 sm:text-[10.5px] font-semibold shadow-sm ${type.text}`}>{type.label}</span>
      {tag && <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] sm:right-2 sm:top-2 sm:px-2 sm:text-[10.5px] font-semibold ${tag.className}`}>{tag.label}</span>}
    </div>
    <div className="flex min-w-0 flex-col gap-1 p-2 sm:p-2.5">
      <h3 title={want.title} className="line-clamp-2 min-h-[2.5em] break-words text-[12.5px] font-medium leading-[1.25] text-emerald-950 sm:text-[13.5px]">{want.title}</h3>
      <p className="break-words text-[11.5px] font-medium leading-snug text-emerald-700 sm:text-[12px]">{budgetLabel(want)}</p>
      <p className="flex min-w-0 items-center gap-1 text-[11px] text-gray-500"><MapPin className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{want.city}</span></p>
      <div className="mt-0.5 flex flex-wrap gap-1">
        <span className="whitespace-nowrap rounded-full bg-lime-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 sm:px-2 sm:text-[10.5px]">{want.joined} joined</span>
        <span className="whitespace-nowrap rounded-full bg-lime-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 sm:px-2 sm:text-[10.5px]">{want.offers} {want.offers === 1 ? "offer" : "offers"}</span>
      </div>
    </div>
    <div className="mt-auto flex shrink-0 items-center justify-center border-t border-[#E6EEDF] px-2 py-2">
      <span className="whitespace-nowrap text-[12px] font-medium sm:text-[12.5px] text-emerald-700 transition-colors group-hover:text-emerald-900">Join request →</span>
    </div>
  </Link>;
}
