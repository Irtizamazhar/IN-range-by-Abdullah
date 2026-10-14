"use client";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";
import { LoadingButton } from "@/components/ui/LoadingButton";

import type { LucideIcon } from "lucide-react";
import Link from "@/components/ui/LoadingLink";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  QrCode,
  Package,
  Cog,
  UsersRound,
  Tag,
  TicketPercent,
  ClipboardList,
  History,
  BarChart3,
  Wallet,
  Users,
  Bell,
  ShieldCheck,
  Settings,
  CircleHelp,
  LogOut,
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
  icon: LucideIcon;
}[] = [
  { href: "/vendor/dashboard", label: "Dashboard", icon: Home },
  { href: "/vendor/dashboard/store", label: "Store & QR", icon: QrCode },
  {
    href: "/vendor/dashboard/products",
    label: "My Products",
    icon: Package,
  },
  { href: "/vendor/dashboard/services", label: "Services", icon: Cog },
  { href: "/vendor/dashboard/demand", label: "Customer Demand", icon: UsersRound },
  { href: "/vendor/dashboard/offers", label: "Offers", icon: Tag },
  { href: "/vendor/dashboard/marketing/coupons", label: "Coupons", icon: TicketPercent },
  {
    href: "/vendor/dashboard/orders",
    label: "My Orders",
    icon: ClipboardList,
  },
  {
    href: "/vendor/dashboard/returns",
    label: "Returns & Disputes",
    icon: History,
  },
  {
    href: "/vendor/dashboard/earnings",
    label: "My Earnings",
    icon: BarChart3,
  },
  {
    href: "/vendor/dashboard/withdrawals",
    label: "Withdrawals",
    icon: Wallet,
  },
  { href: "/vendor/dashboard/followers", label: "Followers", icon: Users },
  {
    href: "/vendor/dashboard/notifications",
    label: "Notifications",
    icon: Bell,
  },
  {
    href: "/vendor/dashboard/account-status",
    label: "Account Status",
    icon: ShieldCheck,
  },
  {
    href: "/vendor/dashboard/settings",
    label: "Settings",
    icon: Settings,
  },
  {
    href: "/vendor/dashboard/help",
    label: "Help & Support",
    icon: CircleHelp,
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
  unreadNotifications = 0,
}: {
  unreadNotifications?: number;
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

  const router = useLoadingRouter();
  async function logout() {
    const response = await fetch("/api/vendor/logout", { method: "POST", credentials: "include" });
    if (!response.ok) throw new Error("Could not sign out. Please try again.");
    clearVendorLoginRememberPrefs();
    await router.replace("/vendor/login");
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-admin-dark text-white">
      <div className="shrink-0 px-4 pb-3 pt-2">
        {/* Shared brand mark with the customer navbar; sized down so it fits the sidebar. */}
        <LogoMark
          inverse
          href="/vendor/dashboard"
          className="shrink-0 [&_span:has(>img)]:!my-0 [&_span:has(>img)]:!h-[4.25rem] [&_span:has(>img)]:!w-[8.25rem]"
        />
        <span className="block pl-1 text-[15px] font-medium text-white/80">Vendor Center</span>
      </div>
      <nav aria-label="Vendor navigation" tabIndex={0} className="admin-sidebar-scrollbar min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 pb-3 focus-visible:outline-none">
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
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[3rem] items-center gap-3.5 rounded-xl px-3.5 text-[15px] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-admin-lime ${
                active
                  ? "bg-admin-lime font-semibold text-admin-dark shadow-sm"
                  : "font-medium text-white/90 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.8} aria-hidden />
              <span className="min-w-0 truncate">
                {label}
                {href === "/vendor/dashboard/notifications" && unreadNotifications > 0 ? (
                  <span className="ml-1 inline-block h-2 w-2 -translate-y-2 rounded-full bg-red-500" title={`${unreadNotifications} unread`} aria-label={`${unreadNotifications} unread`} />
                ) : null}
              </span>
              <span className="flex-1" aria-hidden />
              {showPendingBadge ? (
                <span
                  className="ml-auto min-w-[1.25rem] rounded-full bg-admin-lime px-2 py-0.5 text-center text-[11px] font-bold text-admin-dark tabular-nums"
                  title={`${pendingNew} new order(s) to process`}
                >
                  {pendingNew > 99 ? "99+" : pendingNew}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="mx-3 shrink-0 border-t border-white/15 py-3">
        <LoadingButton
          type="button"
          loadingLabel="Signing out…" onClick={() => logout()}
          className="flex min-h-[3rem] w-full items-center gap-3.5 rounded-xl px-3.5 text-[15px] font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-lime"
        >
          <LogOut className="h-[22px] w-[22px] shrink-0" strokeWidth={1.8} aria-hidden />
          Logout
        </LoadingButton>
      </div>
    </aside>
  );
}
