"use client";
import Link from "@/components/ui/LoadingLink";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, CalendarDays, CircleHelp, ClipboardList, House, Package, Settings, ShoppingCart, Tag, UserRoundPlus, type LucideIcon } from "lucide-react";
/** Each destination's icon and its colour tile (tinted background, matching icon colour). */
const icons: Record<(typeof accountDestinations)[number][0], [LucideIcon, string]> = {
  overview: [House, "bg-[#E3F4E8] text-[#047857]"], orders: [ClipboardList, "bg-[#E8F0FE] text-[#2563EB]"],
  offers: [Tag, "bg-[#FEF3DC] text-[#D97706]"],
  saved: [Bookmark, "bg-[#F0E9FE] text-[#7C3AED]"], stores: [UserRoundPlus, "bg-[#E0F5FA] text-[#0891B2]"],
  stuff: [Package, "bg-[#FBEDE3] text-[#C2410C]"], together: [ShoppingCart, "bg-[#E5F7EA] text-[#16A34A]"],
  services: [CalendarDays, "bg-[#FCE8F3] text-[#DB2777]"], profile: [Settings, "bg-[#ECEFF4] text-[#475569]"],
  help: [CircleHelp, "bg-[#DFF5F1] text-[#0D9488]"],
};
export const accountDestinations = [
  ["overview","Overview","/account"], ["orders","Orders","/account?tab=orders"],
  ["offers","Received Offers","/account/offers"], ["saved","Saved Items","/account?tab=saved"], ["stores","Following","/account?tab=stores"],
  ["stuff","My Stuff","/my-stuff"],
  ["together","Family Cart","/account/together"],
  ["services","Service Bookings","/account/services"], ["profile","Account Settings","/account?tab=profile"],
  ["help","Help & Support","/account/help"],
] as const;
export function AccountNavigation() {
  const pathname = usePathname(); const search = useSearchParams(); const strip = useRef<HTMLDivElement>(null);
  const active = pathname === "/account" ? search?.get("tab") || "overview" : pathname === "/my-stuff" ? "stuff" : pathname?.startsWith("/account/orders/") ? "orders" : pathname?.startsWith("/account/help") ? "help" : pathname?.split("/").pop();
  // On phones the strip scrolls sideways; centre the active card without moving the page.
  useEffect(() => { const row = strip.current; const current = row?.querySelector<HTMLElement>("[aria-current=page]"); if (row && current && row.scrollWidth > row.clientWidth) row.scrollLeft = current.offsetLeft - row.offsetLeft - (row.clientWidth - current.offsetWidth) / 2; }, [active]);
  // The notifications page has its own filter sidebar; the account strip above it is redundant there.
  if (pathname === "/account/notifications") return null;
  // Phones: one swipeable row of cards. Tablets: cards wrap at their natural width. Desktop: one row that fills the width.
  return <nav aria-label="My JORO account" className="mx-auto max-w-site px-4 pt-3 sm:px-6 sm:pt-5"><div ref={strip} className="-mx-4 flex gap-2.5 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 lg:gap-3 xl:gap-2 [&::-webkit-scrollbar]:hidden">{accountDestinations.map(([id,label,href]) => {
    const current = active === id; const [Icon, tile] = icons[id];
    return <Link key={id} href={href} aria-current={current ? "page" : undefined} className={`relative flex min-h-[92px] min-w-[96px] shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-2xl border px-3.5 text-center text-[13px] text-[#064E3B] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-link focus-visible:ring-offset-2 sm:min-h-[84px] lg:min-w-[104px] lg:px-4 lg:text-sm xl:min-w-[84px] xl:grow xl:px-2.5 xl:text-[13px] ${current ? "border-[#CDE8AE] bg-[#ECFBD2] font-semibold shadow-[0_2px_8px_rgba(0,61,43,0.06)]" : "border-[#E5EBE7] bg-white font-medium shadow-[0_1px_2px_rgba(0,61,43,0.04)] hover:border-[#CDE8AE] hover:bg-[#F7FCF1]"}`}>
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tile}`} aria-hidden="true"><Icon className="h-5 w-5" strokeWidth={current ? 2.2 : 2} /></span>{label}
      {current && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-brand-primary" aria-hidden="true" />}
    </Link>;
  })}</div></nav>;
}
