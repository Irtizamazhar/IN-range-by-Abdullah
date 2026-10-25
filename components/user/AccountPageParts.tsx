"use client";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared introduction panel for account pages (My Account overview, My Stuff): eyebrow, heading and text on the
 * left, a white-background illustration on the right that multiply-blends into the green panel. The art is
 * hidden below 360px so the text keeps its width.
 */
export function AccountPageHero({ id, eyebrow, caps = false, title, children, image, action }: {
  id: string; eyebrow: string; caps?: boolean; title: string; children: ReactNode; action?: ReactNode;
  image: { src: string; alt: string; width: number; height: number };
}) {
  return <section aria-labelledby={id} className="overflow-hidden rounded-2xl border border-[#DFEDE5] bg-gradient-to-r from-[#F4FAEF] via-[#F2FAF3] to-[#E7F4DC] sm:rounded-3xl">
    <div className="grid items-center min-[360px]:grid-cols-[minmax(0,1fr)_minmax(0,7rem)] min-[430px]:grid-cols-[minmax(0,1fr)_minmax(0,8.5rem)] sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
      <div className="py-5 pl-5 pr-2 sm:py-6 sm:pl-7 lg:py-7 lg:pl-8">
        <p className={`text-[13px] font-semibold text-brand-link sm:text-sm ${caps ? "uppercase tracking-[0.12em]" : ""}`}>{eyebrow}</p>
        <h1 id={id} className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-[#005235] sm:text-[30px] lg:text-[32px]">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-darkText/65 sm:text-[15px]">{children}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
      <div className="relative hidden h-full min-h-[6.5rem] min-[360px]:block sm:min-h-[8rem]">
        <Image src={image.src} alt={image.alt} width={image.width} height={image.height} unoptimized priority sizes="(min-width: 1024px) 304px, (min-width: 640px) 240px, 136px" className="absolute inset-0 h-full w-full object-contain object-right-bottom pt-2 mix-blend-multiply" />
      </div>
    </div>
  </section>;
}

/** A whole-card link used on account pages: icon, title, optional real count, description and a round arrow. */
export function AccountLinkCard({ href, icon: Icon, title, count, text }: { href: string; icon: LucideIcon; title: string; count?: number; text: string }) {
  return <Link href={href} className="group flex min-w-0 items-center gap-3.5 rounded-2xl border border-[#DFEDE5] bg-white p-4 shadow-[0_1px_2px_rgba(0,61,43,0.04)] transition hover:border-[#B5DCA0] hover:shadow-[0_6px_20px_rgba(0,61,43,0.07)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link sm:gap-4 lg:p-5">
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EAF4EC] text-[#005235] sm:h-12 sm:w-12"><Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={1.75} aria-hidden="true" /></span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold leading-snug text-brand-dark sm:text-[16px] lg:text-[17px]">{title}</span>
      {count !== undefined && <span className="block text-[24px] font-bold leading-tight tabular-nums text-[#005235] sm:text-[26px] lg:text-[28px]">{count.toLocaleString("en-PK")}</span>}
      <span className="mt-0.5 block text-[13px] leading-5 text-darkText/60 sm:text-sm">{text}</span>
    </span>
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#DFEDE5] bg-white text-[#005235] transition group-hover:border-brand-primary group-hover:bg-brand-primary" aria-hidden="true"><ChevronRight className="h-4 w-4" /></span>
  </Link>;
}

/**
 * Status filter pills (left) and a Newest/Oldest sort (right from xl, its own row below). Both are links into the
 * URL, so they survive reloads and work with pagination. On phones the pills scroll sideways inside the row.
 */
export function AccountFilterToolbar({ label, filters, sort, sortHref }: { label: string; filters: { label: string; href: string; active: boolean }[]; sort: string; sortHref: (sort: string) => string }) {
  const router = useLoadingRouter();
  return <div className="mt-4 flex flex-col gap-3 lg:mt-5 xl:flex-row xl:items-center xl:justify-between">
    <nav aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
      {filters.map(f => <Link key={f.label} href={f.href} aria-current={f.active ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link sm:text-sm ${f.active ? "bg-brand-primary text-brand-dark" : "border border-[#DFEDE5] bg-white text-[#005235] hover:border-[#B5DCA0] hover:bg-brand-soft"}`}>{f.label}</Link>)}
    </nav>
    <label className="flex shrink-0 items-center gap-2 text-[13px] text-darkText/65 sm:text-sm">Sort by:
      <span className="relative">
        <select value={sort} onChange={e => router.push(sortHref(e.target.value))} className="h-10 appearance-none rounded-xl border border-[#DFEDE5] bg-white py-0 pl-3.5 pr-9 text-[13px] font-semibold text-brand-dark focus:border-brand-link focus:outline-none focus:ring-2 focus:ring-brand-link/20 sm:text-sm">
          <option value="newest">Newest First</option><option value="oldest">Oldest First</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-darkText/60" aria-hidden="true" />
      </span>
    </label>
  </div>;
}
