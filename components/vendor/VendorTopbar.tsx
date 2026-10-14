"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Search, Settings, ShieldCheck, Store } from "lucide-react";
import Link from "@/components/ui/LoadingLink";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "V";
}

/** Vendor panel top bar: order search, notifications shortcut and profile menu. */
export function VendorTopbar({
  ownerName,
  shopName,
  unreadNotifications,
}: {
  ownerName: string;
  shopName: string;
  unreadNotifications: number;
}) {
  const router = useLoadingRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    void router.push(term ? `/vendor/dashboard/orders?q=${encodeURIComponent(term)}` : "/vendor/dashboard/orders");
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
      <form role="search" onSubmit={submit} className="min-w-0 flex-1 lg:max-w-[36rem]">
        <label className="relative block">
          <span className="sr-only">Search orders</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-admin-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search orders by number or customer…"
            className="h-11 w-full min-w-0 rounded-xl border border-admin-border bg-admin-bg/60 pl-10 pr-3 text-[15px] text-admin-ink placeholder:text-admin-muted/80 focus:border-admin-primary/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-admin-primary/15"
          />
        </label>
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        <Link
          href="/vendor/dashboard/notifications"
          aria-label={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : "Notifications"}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-admin-ink transition-colors hover:bg-admin-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-primary"
        >
          <Bell className="h-[22px] w-[22px]" strokeWidth={1.9} aria-hidden />
          {unreadNotifications > 0 ? (
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" aria-hidden />
          ) : null}
        </Link>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-3 rounded-xl p-1 pr-1.5 text-left transition-colors hover:bg-admin-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-primary sm:pr-2"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-admin-primary text-sm font-bold text-admin-lime">
              {initials(ownerName)}
            </span>
            <span className="hidden min-w-0 md:block">
              <span className="block max-w-[11rem] truncate text-[15px] font-semibold leading-tight text-admin-ink">{ownerName}</span>
              <span className="block text-[13px] leading-tight text-admin-muted">Store Owner</span>
            </span>
            <ChevronDown className={`hidden h-5 w-5 text-admin-ink transition-transform sm:block ${menuOpen ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {menuOpen ? (
            <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-admin-border bg-white py-1 shadow-[0_12px_32px_rgba(0,61,43,0.14)]">
              <div className="border-b border-admin-border px-4 py-3">
                <p className="truncate text-sm font-semibold text-admin-ink">{ownerName}</p>
                <p className="truncate text-xs text-admin-muted" title={shopName}>{shopName}</p>
              </div>
              {[
                { href: "/vendor/dashboard/store", label: "Store & QR", icon: Store },
                { href: "/vendor/dashboard/account-status", label: "Account Status", icon: ShieldCheck },
                { href: "/vendor/dashboard/settings", label: "Settings", icon: Settings },
              ].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} role="menuitem" className="flex items-center gap-3 px-4 py-2.5 text-sm text-admin-ink hover:bg-admin-bg">
                  <Icon className="h-4 w-4 text-admin-muted" aria-hidden />
                  {label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
