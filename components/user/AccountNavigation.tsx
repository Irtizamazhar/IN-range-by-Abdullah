"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
export const accountDestinations = [
  ["overview","Overview","/account"], ["orders","Orders","/account?tab=orders"], ["wants","My Wants","/account?tab=wants"],
  ["offers","Received Offers","/account/offers"], ["saved","Saved","/account?tab=saved"], ["stores","Following","/account?tab=stores"],
  ["notifications","Notifications","/account/notifications"], ["returns","Returns / After-sales","/my-stuff?tab=returns"],
  ["together","Family Cart","/account/together"],
  ["services","Services / My Stuff","/account/services"], ["profile","Profile","/account?tab=profile"], ["addresses","Addresses","/account?tab=addresses"],
] as const;
export function AccountNavigation() {
  const pathname = usePathname(); const search = useSearchParams();
  const active = pathname === "/account" ? search?.get("tab") || "overview" : pathname === "/my-stuff" ? "returns" : pathname?.startsWith("/account/orders/") ? "orders" : pathname?.split("/").pop();
  return <nav aria-label="My JORO account" className="mx-auto max-w-7xl px-4 pt-6 sm:px-6"><div className="flex flex-wrap gap-2 border-b border-borderGray pb-4">{accountDestinations.map(([id,label,href]) => <Link key={id} href={href} aria-current={active === id ? "page" : undefined} className={`rounded-xl px-3 py-2.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link ${active === id ? "bg-brand-primary text-brand-dark" : "border border-borderGray bg-white text-brand-link hover:bg-brand-soft"}`}>{label}</Link>)}</div></nav>;
}