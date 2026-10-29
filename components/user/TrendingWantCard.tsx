"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { ArrowRight, Gift, MapPin, Package, Tag, UsersRound, Wrench } from "lucide-react";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

export type TrendingWant = {
  id: string; title: string; requestType: string; city: string; photo: string | null; createdAt: Date | string;
  budgetMin: number | null; budgetMax: number | null; budgetFlexible: boolean;
  joined: number; offers: number;
};

const TYPES: Record<string, { label: string; badge: string; media: string; fallback: string; Icon: typeof Package }> = {
  PRODUCT: { label: "Product", badge: "bg-[#DDF9E9] text-[#005B3E]", media: "from-[#F1FAEE] via-white to-[#E4F8E9]", fallback: "bg-[#DDF9E9] text-[#005B3E]", Icon: Package },
  SERVICE: { label: "Service", badge: "bg-[#E1F1FF] text-[#0759A9]", media: "from-[#F1F9FF] via-white to-[#DFF1FF]", fallback: "bg-[#DDEFFF] text-[#0759A9]", Icon: Wrench },
  GIFT: { label: "Gift", badge: "bg-[#FFE4ED] text-[#CA285F]", media: "from-[#FFF3F6] via-white to-[#FFE5ED]", fallback: "bg-[#FFE1EB] text-[#CA285F]", Icon: Gift },
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
  if (Date.now() - new Date(want.createdAt).getTime() < DAY_MS) return { label: "New", className: "bg-lime-100 text-[#005055]" };
  return null;
}

/** The full card keeps the existing navigation to the Want detail and its join flow. */
export function TrendingWantCard({ want }: { want: TrendingWant }) {
  const [failed, setFailed] = useState(false);
  const type = TYPES[want.requestType] || TYPES.PRODUCT;
  const tag = highlight(want);
  const showImage = want.photo && !failed;

  return <Link href={`/wants/${want.id}`} className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#E7EEE5] bg-white shadow-[0_7px_20px_rgba(0,64,43,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-[#B8D8B7] hover:shadow-[0_12px_28px_rgba(0,64,43,0.12)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005055]">
    <div className={`relative aspect-[4/3] shrink-0 overflow-hidden bg-gradient-to-br ${type.media}`}>
      <div className="absolute -bottom-6 left-[15%] h-24 w-24 rounded-full bg-white/50 blur-xl" aria-hidden="true" />
      <div className="absolute -right-4 top-[25%] h-20 w-20 rounded-full bg-white/50 blur-xl" aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-2 pt-8 sm:p-3 sm:pt-9 lg:pt-8">
        {showImage
          ? <Image src={want.photo!} alt="" width={480} height={360} loading="lazy" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" unoptimized={shouldUnoptimizeImageSrc(want.photo!)} onError={() => setFailed(true)} className="block h-auto max-h-full w-auto max-w-full object-contain" />
          : <span className={`flex h-14 w-14 items-center justify-center rounded-[18px] shadow-sm sm:h-16 sm:w-16 ${type.fallback}`}><type.Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.7} aria-hidden="true" /></span>}
      </div>
      <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold shadow-sm sm:left-3 sm:top-3 sm:gap-1.5 sm:px-2.5 sm:text-xs ${type.badge}`}><type.Icon className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" strokeWidth={1.8} aria-hidden="true" />{type.label}</span>
      {tag && <span className={`absolute right-2 top-2 rounded-full px-1.5 py-1 text-[9px] font-semibold sm:right-3 sm:top-3 sm:px-2 sm:text-[10px] ${tag.className}`}>{tag.label}</span>}
    </div>
    <div className="flex min-w-0 flex-1 flex-col px-2.5 pb-2 pt-2.5 sm:px-3 sm:pb-3 sm:pt-3">
      <h3 title={want.title} className="line-clamp-2 min-h-[2.6em] break-words text-[13px] font-bold leading-[1.3] text-[#102423] sm:text-[15px]">{want.title}</h3>
      <p className="mt-1 break-words text-[12px] font-bold leading-tight text-[#08734E] sm:text-sm">{budgetLabel(want)}</p>
      <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] leading-tight text-slate-500 sm:text-xs"><MapPin className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{want.city}</span></p>
      <div className="mt-auto flex flex-wrap gap-1 pt-2.5">
        <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#EFF8E7] px-1.5 py-1 text-[9px] font-medium leading-none text-[#00543C] sm:px-2 sm:text-[11px]"><UsersRound className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />{want.joined} joined</span>
        <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#EFF8E7] px-1.5 py-1 text-[9px] font-medium leading-none text-[#00543C] sm:px-2 sm:text-[11px]"><Tag className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />{want.offers} {want.offers === 1 ? "offer" : "offers"}</span>
      </div>
    </div>
    <div className="shrink-0 px-2.5 pb-2.5 sm:px-3 sm:pb-3">
      <span className="flex min-h-11 items-center justify-between gap-1 whitespace-nowrap rounded-[15px] bg-gradient-to-r from-[#005055] via-[#08784B] to-[#B8E632] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-[0_5px_12px_rgba(0,98,65,0.18)] transition duration-200 group-hover:shadow-[0_7px_16px_rgba(0,98,65,0.28)] group-active:scale-[0.98] sm:px-3 sm:text-sm">Join Request<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E9F9BF] text-[#005055] sm:h-7 sm:w-7"><ArrowRight aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5}/></span></span>
    </div>
  </Link>;
}
