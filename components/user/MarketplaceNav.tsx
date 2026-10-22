"use client";
import Link from "@/components/ui/LoadingLink";
import { Home, LayoutGrid, Megaphone, ShoppingCart, User } from "lucide-react";
import { usePathname } from "next/navigation";
export function MarketplaceNav() {
  const pathname = usePathname();
  return <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#dce7dc] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_22px_rgba(3,47,29,0.06)] backdrop-blur md:hidden">{([{ href: "/", label: "Home", Icon: Home },{ href: "/products", label: "Categories", Icon: LayoutGrid },{ href: "/wants", label: "Wants", Icon: Megaphone },{ href: "/cart", label: "Cart", Icon: ShoppingCart },{ href: "/account", label: "Profile", Icon: User }]).map(({href,label,Icon}) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className="m-1 flex min-w-0 min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[10px] font-semibold text-[#5e766a] transition-colors hover:bg-[#eef6e7] hover:text-brand-link focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link aria-[current=page]:bg-[#eaf4dc] aria-[current=page]:text-brand-link"><Icon aria-hidden="true" className="h-5 w-5" />{label}</Link>)}</nav>;
}
