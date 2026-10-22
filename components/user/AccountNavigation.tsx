"use client";
import Link from "@/components/ui/LoadingLink";
import { usePathname, useSearchParams } from "next/navigation";
export const accountDestinations = [
  ["overview","Overview","/account"], ["orders","Orders","/account?tab=orders"], ["wants","My Wants","/account?tab=wants"],
  ["offers","Received Offers","/account/offers"], ["saved","Saved Items","/account?tab=saved"], ["stores","Following","/account?tab=stores"],
  ["notifications","Notifications","/account/notifications"], ["stuff","My Stuff","/my-stuff"],
  ["together","Family Cart","/account/together"],
  ["services","Service Bookings","/account/services"], ["profile","Account Settings","/account?tab=profile"], ["addresses","Addresses","/account?tab=addresses"],
  ["help","Help & Support","/account/help"],
] as const;
export function AccountNavigation() {
  const pathname = usePathname(); const search = useSearchParams();
  // The notifications page has its own filter sidebar; the account strip above it is redundant there.
  if (pathname === "/account/notifications") return null;
  const active = pathname === "/account" ? search?.get("tab") || "overview" : pathname === "/my-stuff" ? "stuff" : pathname?.startsWith("/account/orders/") ? "orders" : pathname?.startsWith("/account/help") ? "help" : pathname?.split("/").pop();
  return <nav aria-label="My JORO account" className="mx-auto max-w-7xl px-4 pt-6 sm:px-6"><div className="flex flex-wrap gap-2 border-b border-borderGray pb-4">{accountDestinations.map(([id,label,href]) => <Link key={id} href={href} aria-current={active === id ? "page" : undefined} className={`rounded-xl px-3 py-2.5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link ${active === id ? "bg-brand-primary text-brand-dark" : "border border-borderGray bg-white text-brand-link hover:bg-brand-soft"}`}>{label}</Link>)}</div></nav>;
}
