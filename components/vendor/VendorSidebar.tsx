"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  LogOut,
  Wallet,
  Settings,
  Bell,
  CircleDollarSign,
} from "lucide-react";
import { LogoMark } from "@/components/user/LogoMark";
import { clearVendorLoginRememberPrefs } from "@/lib/vendor-login-remember-prefs";

/** Pending count last acknowledged on My Orders — badge shows new items since then (clears when you open that page). */
const VENDOR_PENDING_ACK_KEY = "vendor_pending_badge_ack";

function readPendingAck(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(VENDOR_PENDING_ACK_KEY);
    if (raw == null || raw === "") return null;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writePendingAck(n: number) {
  try {
    sessionStorage.setItem(VENDOR_PENDING_ACK_KEY, JSON.stringify(n));
  } catch {
    /* ignore quota / private mode */
  }
}

function isVendorOrdersPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/vendor\/dashboard\/orders(\/|$)/.test(pathname);
}

const links: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { href: "/vendor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/vendor/dashboard/orders",
    label: "My Orders",
    icon: ShoppingBag,
  },
  {
    href: "/vendor/dashboard/products",
    label: "My Products",
    icon: Package,
  },
  {
    href: "/vendor/dashboard/earnings",
    label: "My Earnings",
    icon: CircleDollarSign,
  },
  {
    href: "/vendor/dashboard/withdrawals",
    label: "Withdrawals",
    icon: Wallet,
  },
  {
    href: "/vendor/dashboard/notifications",
    label: "Notifications",
    icon: Bell,
  },
  {
    href: "/vendor/dashboard/settings",
    label: "Settings",
    icon: Settings,
  },
];

function linkActive(pathname: string | null, href: string): boolean {
  if (pathname == null) return false;
  if (href === "/vendor/dashboard") {
    return pathname === "/vendor/dashboard";
  }
  if (href === "/vendor/dashboard/withdrawals") {
    return (
      pathname === "/vendor/dashboard/withdrawals" ||
      pathname.startsWith("/vendor/dashboard/withdrawals/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function VendorSidebar({
  shopName,
}: {
  shopName: string;
}) {
  const pathname = usePathname();
  const [pendingOrders, setPendingOrders] = useState(0);
  const [pendingAck, setPendingAck] = useState<number | null>(() =>
    typeof window !== "undefined" ? readPendingAck() : null
  );

  useEffect(() => {
    let cancelled = false;
    let ack = readPendingAck();
    setPendingAck(ack);

    (async () => {
      try {
        const r = await fetch("/api/orders/vendor?countsOnly=1", {
          credentials: "include",
        });
        if (!r.ok) return;
        const data = (await r.json()) as { counts?: Record<string, number> };
        const n = Number(data.counts?.pending ?? 0);
        const pending = Number.isFinite(n) ? n : 0;
        if (cancelled) return;

        if (ack != null && pending < ack) {
          ack = pending;
          writePendingAck(pending);
        }
        if (isVendorOrdersPath(pathname)) {
          ack = pending;
          writePendingAck(pending);
        }

        setPendingOrders(pending);
        setPendingAck(ack);
      } catch {
        if (!cancelled) setPendingOrders(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function logout() {
    try {
      await fetch("/api/vendor/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* still leave */
    }
    clearVendorLoginRememberPrefs();
    window.location.href = "/vendor/login";
  }

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col bg-footerDark text-white">
      <div className="border-b border-white/10 p-4">
        <div className="min-w-0 flex-1">
          <LogoMark
            href="/vendor/dashboard"
            className="shrink-0 [&_img]:max-w-[min(100%,260px)]"
          />
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-primaryYellow">
            Vendor
          </p>
          {shopName ? (
            <p
              className="mt-1 truncate text-xs font-normal text-white/70"
              title={shopName}
            >
              {shopName}
            </p>
          ) : null}
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = linkActive(pathname, href);
          const onOrdersSection = isVendorOrdersPath(pathname);
          const pendingNew =
            pendingAck == null
              ? pendingOrders
              : Math.max(0, pendingOrders - pendingAck);
          const showPendingBadge =
            href === "/vendor/dashboard/orders" &&
            pendingNew > 0 &&
            !onOrdersSection;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-200 ${
                active
                  ? "bg-[#1BACE4] font-semibold text-white shadow-sm"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {showPendingBadge ? (
                <span
                  className="ml-auto min-w-[1.25rem] rounded-full bg-red-500 px-2 py-0.5 text-center text-[11px] font-bold text-white tabular-nums"
                  title={`${pendingNew} new order(s) to process`}
                >
                  {pendingNew > 99 ? "99+" : pendingNew}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/10"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}
