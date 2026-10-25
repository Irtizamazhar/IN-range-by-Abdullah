"use client";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { Boxes, CalendarDays, ChevronRight, Clock3, MapPin, MessageSquareText, Tag, Users, Wallet } from "lucide-react";
import { AccountFilterToolbar } from "@/components/user/AccountPageParts";
import { PostWantButton } from "@/components/user/PostWantButton";

export type AccountWant = { id: string; title: string; status: string; category: string; city: string; quantity: number; budgetMin: number | null; budgetMax: number | null; budgetFlexible: boolean; moderationReason: string | null; createdAt: string; expiresAt: string; interestCount: number; offerCount: number };

/** Filters are the stored WantStatus values (the API validates them again); `null` is All Wants. */
export const WANT_FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: "All Wants" }, { value: "OPEN", label: "Open" }, { value: "PENDING_MODERATION", label: "In review" }, { value: "DRAFT", label: "Draft" },
  { value: "FULFILLED", label: "Fulfilled" }, { value: "CLOSED", label: "Closed" }, { value: "EXPIRED", label: "Expired" }, { value: "REJECTED", label: "Rejected" },
];
const STATUS: Record<string, [string, string]> = {
  OPEN: ["Open", "bg-emerald-50 text-emerald-700 ring-emerald-200 before:bg-emerald-500"], PENDING_MODERATION: ["In review", "bg-amber-50 text-amber-800 ring-amber-200 before:bg-amber-500"], SUBMITTED: ["Submitted", "bg-amber-50 text-amber-800 ring-amber-200 before:bg-amber-500"],
  DRAFT: ["Draft", "bg-gray-100 text-gray-700 ring-gray-200 before:bg-gray-400"], FULFILLED: ["Fulfilled", "bg-sky-50 text-sky-700 ring-sky-200 before:bg-sky-500"], CLOSED: ["Closed", "bg-gray-100 text-gray-700 ring-gray-200 before:bg-gray-400"],
  EXPIRED: ["Expired", "bg-gray-100 text-gray-700 ring-gray-200 before:bg-gray-400"], REJECTED: ["Rejected", "bg-red-50 text-red-700 ring-red-200 before:bg-red-500"],
};
export const wantsHref = (status: string | null, sort: string) => `/account?tab=wants${status ? `&wantStatus=${status}` : ""}${sort === "oldest" ? "&wantSort=oldest" : ""}`;
const pkr = (n: number | null) => (n || 0).toLocaleString("en-PK");
const date = (value: string) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PK"); };
const postButton = "inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-primary px-5 text-sm font-semibold text-brand-dark transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link";

export function PostWantAction() { return <PostWantButton className={postButton}>Post a Want</PostWantButton>; }

export function WantToolbar({ status, sort }: { status: string | null; sort: string }) {
  return <AccountFilterToolbar label="Filter wants by status" filters={WANT_FILTERS.map(f => ({ label: f.label, href: wantsHref(f.value, sort), active: status === f.value }))} sort={sort} sortHref={value => wantsHref(status, value)} />;
}

/**
 * One posted Want: title with its status badge, a category/city/quantity line, the budget, interest and offer
 * counts, the moderation note in a tinted box, and the dates; the arrow (and the title) open the Want.
 */
export function AccountWantCard({ want }: { want: AccountWant }) {
  const [statusLabel, tone] = STATUS[want.status] || [want.status.replaceAll("_", " ").toLowerCase(), "bg-gray-100 text-gray-700 ring-gray-200 before:bg-gray-400"];
  const icon = "h-4 w-4 shrink-0 text-darkText/40";
  const chip = "inline-flex items-center gap-1.5 rounded-lg bg-[#F4F8F2] px-2.5 py-1 text-xs font-medium text-darkText/70 sm:text-[13px]";
  const offers = want.offerCount; const interested = want.interestCount;
  return <article aria-labelledby={`want-${want.id}`} className="group/card flex h-full flex-col rounded-2xl border border-[#E3ECE6] bg-white p-4 shadow-[0_1px_2px_rgba(0,61,43,0.04)] transition hover:border-[#C9E2CF] hover:shadow-[0_8px_24px_rgba(0,61,43,0.08)] sm:p-5">
    <div className="flex flex-1 gap-3 sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1.5">
          <h2 id={`want-${want.id}`} className="min-w-0 break-words text-base font-bold leading-snug text-brand-dark sm:text-[17px]"><Link href={`/wants/${want.id}`} className="hover:text-[#005235] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link">{want.title}</Link></h2>
          <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset before:h-1.5 before:w-1.5 before:rounded-full sm:text-xs ${tone}`}><span className="sr-only">Status: </span>{statusLabel}</span>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-darkText/65 sm:text-sm">
          <span className="inline-flex min-w-0 items-center gap-1.5"><Tag className={icon} aria-hidden="true" /><span className="sr-only">Category: </span><span className="break-words">{want.category || "—"}</span></span>
          <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className={icon} aria-hidden="true" /><span className="sr-only">City: </span><span className="break-words">{want.city || "—"}</span></span>
          <span className="inline-flex items-center gap-1.5"><Boxes className={icon} aria-hidden="true" />Qty {want.quantity.toLocaleString("en-PK")}</span>
        </p>
        <p className="mt-2.5 flex min-w-0 items-center gap-2"><Wallet className="h-4 w-4 shrink-0 text-[#005235]/70" aria-hidden="true" /><span className="sr-only">Budget: </span><span className="min-w-0 break-words text-[15px] font-semibold tabular-nums text-[#005235] sm:text-base">{want.budgetFlexible ? "Budget flexible" : `PKR ${pkr(want.budgetMin)} – ${pkr(want.budgetMax)}`}</span></p>
        <p className="mt-2.5 flex flex-wrap gap-2">
          <span className={chip}><Users className="h-3.5 w-3.5 shrink-0 text-darkText/45" aria-hidden="true" />{interested} interested</span>
          <span className={chip}><MessageSquareText className="h-3.5 w-3.5 shrink-0 text-darkText/45" aria-hidden="true" />{offers} {offers === 1 ? "offer" : "offers"}</span>
        </p>
        {want.moderationReason && <p className="mt-2.5 break-words rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-900"><span className="font-semibold">Note:</span> {want.moderationReason}</p>}
      </div>
      <Link href={`/wants/${want.id}`} aria-label={`Open ${want.title}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full border border-[#DFEDE5] bg-white text-[#005235] transition hover:border-brand-primary hover:bg-brand-primary group-hover/card:border-[#B5DCA0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link"><ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
    </div>
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#EEF3EF] pt-3 text-xs text-darkText/55">
      <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Created {date(want.createdAt)}</span>
      <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Expires {date(want.expiresAt)}</span>
    </p>
  </article>;
}

/** No Wants at all (with a Post a Want action), or none for the selected filter (with a way back to all). */
export function WantsEmpty({ status, sort }: { status: string | null; sort: string }) {
  const filter = WANT_FILTERS.find(f => f.value === status)?.label.toLowerCase();
  return <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#CFE3D4] bg-gradient-to-b from-white to-[#FAFDF7] px-5 py-6 text-center sm:py-8">
    <Image src="/images/my-stuff/empty-box.webp" alt="" width={480} height={480} priority sizes="(min-width: 640px) 144px, 120px" className="h-[120px] w-[120px] object-contain mix-blend-multiply sm:h-36 sm:w-36" />
    <h2 className="mt-1 text-base font-semibold text-[#005235] sm:text-[17px]">{status ? `No ${filter} wants` : "No Wants yet"}</h2>
    <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-darkText/60 sm:text-sm">{status ? "None of your Wants have this status right now." : "Post what you need and sellers will send you offers."}</p>
    <div className="mt-4">{status ? <Link href={wantsHref(null, sort)} className="text-sm font-semibold text-brand-link underline">Show all wants</Link> : <PostWantAction />}</div>
  </div>;
}
