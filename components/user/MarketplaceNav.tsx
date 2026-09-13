"use client";
import Link from "next/link";
import { Home, LayoutGrid, Megaphone, ShoppingCart, User } from "lucide-react";
import { usePathname } from "next/navigation";
export function MarketplaceNav() {
  const pathname = usePathname();
  return <><nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden">{([{ href: "/", label: "Home", Icon: Home },{ href: "/products", label: "Categories", Icon: LayoutGrid },{ href: "/wants", label: "Wants", Icon: Megaphone },{ href: "/cart", label: "Cart", Icon: ShoppingCart },{ href: "/account", label: "Profile", Icon: User }]).map(({href,label,Icon}) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className="flex min-w-0 flex-col items-center gap-1 py-3 text-xs text-brand-link"><Icon aria-hidden="true" className="h-5 w-5" />{label}</Link>)}</nav><div className="h-16 md:hidden" aria-hidden="true" /></>;
}