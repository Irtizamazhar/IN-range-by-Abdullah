"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { ArrowRight, Gift, Heart, MapPin, Package, Tag, UserPlus, UsersRound, Wrench } from "lucide-react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

/** Server-built avatar data: an image URL and a first initial only (no ids or names). */
type Joiner = { image: string | null; initial: string };

export type TrendingWant = {
  id: string; title: string; requestType: string; city: string; photo: string | null; createdAt: Date | string;
  budgetMin: number | null; budgetMax: number | null; budgetFlexible: boolean;
  joined: number; offers: number;
  /** Latest active joiners (up to 3) for the avatar stack; `joined` is the full count. */
  joiners: Joiner[];
  /** Whether the viewer has the "Love" reaction on this Want. */
  loved: boolean;
};

const TYPES: Record<string, { label: string; badge: string; media: string; fallback: string; Icon: typeof Package }> = {
  PRODUCT: { label: "Product", badge: "bg-[#DDF9E9] text-[#005B3E]", media: "from-[#F1FAEE] via-white to-[#E4F8E9]", fallback: "bg-[#DDF9E9] text-[#005B3E]", Icon: Package },
  SERVICE: { label: "Service", badge: "bg-[#E1F1FF] text-[#0759A9]", media: "from-[#F1F9FF] via-white to-[#DFF1FF]", fallback: "bg-[#DDEFFF] text-[#0759A9]", Icon: Wrench },
  GIFT: { label: "Gift", badge: "bg-[#FFE4ED] text-[#CA285F]", media: "from-[#FFF3F6] via-white to-[#FFE5ED]", fallback: "bg-[#FFE1EB] text-[#CA285F]", Icon: Gift },
};
const AVATAR_TONES = ["bg-[#DDF9E9] text-[#005B3E]", "bg-[#E1F1FF] text-[#0759A9]", "bg-[#FFF1D6] text-[#8A5300]"];
const pkr = (value: number) => value.toLocaleString("en-PK", { maximumFractionDigits: 0 });

function budgetLabel(want: TrendingWant) {
  const min = want.budgetMin ?? 0, max = want.budgetMax ?? 0;
  if (want.budgetFlexible || (!min && !max)) return "Flexible";
  if (!max || min === max) return `PKR ${pkr(max || min)}`;
  return min ? `PKR ${pkr(min)} – ${pkr(max)}` : `Up to PKR ${pkr(max)}`;
}

function Avatar({ joiner, index }: { joiner: Joiner; index: number }) {
  const [failed, setFailed] = useState(false);
  const ring = "relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-white";
  if (joiner.image && !failed) {
    return <span className={`${ring} bg-white`}><Image src={joiner.image} alt="" fill sizes="32px" unoptimized onError={() => setFailed(true)} className="object-cover" /></span>;
  }
  return <span className={`${ring} text-[11px] font-bold ${AVATAR_TONES[index % AVATAR_TONES.length]}`}>{joiner.initial || "?"}</span>;
}

/** Heart = the viewer's existing "Love" reaction on the Want (same API as the Wants feed). */
function LoveButton({ wantId, initial }: { wantId: string; initial: boolean }) {
  const { openAuthModal } = useCustomerAuth();
  const [loved, setLoved] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (saving) return;
    const next = !loved;
    setSaving(true);
    setLoved(next);
    try {
      const response = await fetch(`/api/wants/${wantId}/reaction`, next
        ? { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "LOVE" }) }
        : { method: "DELETE" });
      if (response.status === 401) { setLoved(!next); void openAuthModal("login"); return; }
      if (!response.ok) { setLoved(!next); return; }
      const data = await response.json().catch(() => null) as { reaction?: string | null } | null;
      setLoved(data?.reaction === "LOVE");
    } catch {
      setLoved(!next);
    } finally {
      setSaving(false);
    }
  }

  return <button type="button" onClick={() => void toggle()} disabled={saving} aria-pressed={loved} aria-label={loved ? "Remove from loved" : "Love this request"}
    className="absolute right-2.5 top-2.5 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-[0_3px_10px_rgba(0,0,0,0.12)] transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005055] disabled:opacity-80 sm:right-3 sm:top-3">
    <Heart className={`h-[18px] w-[18px] ${loved ? "fill-[#E5484D] text-[#E5484D]" : "text-[#E5484D]"}`} strokeWidth={2.2} aria-hidden="true" />
  </button>;
}

/** The whole card opens the Want detail (where the join flow lives); only the heart is a separate control. */
export function TrendingWantCard({ want }: { want: TrendingWant }) {
  const [failed, setFailed] = useState(false);
  const type = TYPES[want.requestType] || TYPES.PRODUCT;
  const showImage = want.photo && !failed;
  const joiners = want.joiners.slice(0, 3);
  const extra = Math.max(0, want.joined - joiners.length);

  return <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#E7EEE5] bg-white shadow-[0_7px_20px_rgba(0,64,43,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-[#B8D8B7] hover:shadow-[0_12px_28px_rgba(0,64,43,0.12)] has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-[#005055]">
    <div className={`relative aspect-[16/9] shrink-0 overflow-hidden bg-gradient-to-br sm:aspect-[16/10] ${type.media}`}>
      {showImage
        ? <Image src={want.photo!} alt="" fill loading="lazy" sizes="(min-width: 1280px) 300px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" unoptimized={shouldUnoptimizeImageSrc(want.photo!)} onError={() => setFailed(true)} className="object-cover transition duration-300 group-hover:scale-[1.03]" />
        : <span className="absolute inset-0 flex items-center justify-center"><span className={`flex h-14 w-14 items-center justify-center rounded-[18px] shadow-sm sm:h-16 sm:w-16 ${type.fallback}`}><type.Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.7} aria-hidden="true" /></span></span>}
      <LoveButton wantId={want.id} initial={want.loved} />
    </div>
    <div className="flex min-w-0 flex-1 flex-col px-3.5 pb-3 pt-3">
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:text-xs ${type.badge}`}><type.Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />{type.label}</span>
      <h3 title={want.title} className="mt-2 line-clamp-2 break-words text-[15px] font-bold leading-[1.3] text-[#102423] sm:min-h-[2.6em] sm:text-base">
        <Link href={`/wants/${want.id}`} className="outline-none after:absolute after:inset-0 after:z-10 after:content-['']">{want.title}</Link>
      </h3>
      <p className="mt-1.5 break-words text-[15px] font-bold leading-tight text-[#08734E] sm:text-base">{budgetLabel(want)}</p>
      <p className="mt-1 flex min-w-0 items-center gap-1 text-xs leading-tight text-slate-500"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{want.city}</span></p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-2.5">
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#EFF8E7] px-2 py-1 text-[11px] font-medium leading-none text-[#00543C] sm:text-xs"><UsersRound className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />{want.joined} joined</span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#EFF8E7] px-2 py-1 text-[11px] font-medium leading-none text-[#00543C] sm:text-xs"><Tag className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />{want.offers} {want.offers === 1 ? "offer" : "offers"}</span>
      </div>
    </div>
    <div className="shrink-0 px-3 pb-3">
      <span className="flex min-h-[52px] items-center gap-2 rounded-2xl xl:gap-1.5 bg-gradient-to-r from-[#00483B] via-[#08784B] to-[#9BD83A] py-2 pl-2 pr-2 text-white shadow-[0_6px_14px_rgba(0,98,65,0.2)] transition duration-200 group-hover:shadow-[0_8px_18px_rgba(0,98,65,0.3)] group-active:scale-[0.98]">
        <span className="flex shrink-0 items-center" aria-label={`${want.joined} joined`}>
          {joiners.length
            ? <span className="flex -space-x-2">{joiners.map((joiner, index) => <Avatar key={index} joiner={joiner} index={index} />)}</span>
            : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/70"><UserPlus className="h-3.5 w-3.5" aria-hidden="true" /></span>}
          {extra > 0 && <span className="-ml-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#E9F9BF] px-1 text-[10px] font-bold text-[#005055] ring-2 ring-white">+{extra > 99 ? "99" : extra}</span>}
        </span>
        <span className="h-6 w-px shrink-0 bg-white/30" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-center text-sm font-bold xl:text-[13px]">Join Request</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E9F9BF] text-[#005055] xl:h-8 xl:w-8"><ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} /></span>
      </span>
    </div>
  </article>;
}
