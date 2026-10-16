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
  dividerBefore?: boolean;
}[] = [
  { href: "/vendor/dashboard", label: "Dashboard", icon: Home },
  { href: "/vendor/dashboard/store", label: "Store & QR", icon: QrCode, dividerBefore: true },
  { href: "/vendor/dashboard/products", label: "My Products", icon: Package },
  { href: "/vendor/dashboard/services", label: "Services", icon: Cog },
  { href: "/vendor/dashboard/demand", label: "Customer Demand", icon: UsersRound },
  { href: "/vendor/dashboard/offers", label: "Offers", icon: Tag },
  { href: "/vendor/dashboard/marketing/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/vendor/dashboard/orders", label: "My Orders", icon: ClipboardList, dividerBefore: true },
  { href: "/vendor/dashboard/returns", label: "Returns & Disputes", icon: History },
  { href: "/vendor/dashboard/earnings", label: "My Earnings", icon: BarChart3, dividerBefore: true },
  { href: "/vendor/dashboard/withdrawals", label: "Withdrawals", icon: Wallet },
  { href: "/vendor/dashboard/followers", label: "Followers", icon: Users, dividerBefore: true },
  { href: "/marketing/preferences", label: "Email Preferences", icon: Settings },
  { href: "/vendor/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/vendor/dashboard/account-status", label: "Account Status", icon: ShieldCheck, dividerBefore: true },
  { href: "/vendor/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/vendor/dashboard/help", label: "Help & Support", icon: CircleHelp },
];

const badgeBase =
  "ml-auto min-w-[1.375rem] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold leading-4 tabular-nums";

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
  collapsed = false,
}: {
  unreadNotifications?: number;
  collapsed?: boolean;
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
      <div className={`flex shrink-0 items-center border-b border-white/10 ${collapsed ? "justify-center px-2 py-3" : "gap-2 px-4 py-2"}`}>
        {/* Shared brand mark with the customer navbar; sized down so it fits the sidebar. */}
        <LogoMark
          inverse
          href="/vendor/dashboard"
          className={
            collapsed
              ? "shrink-0 [&_span:has(>img)]:!m-0 [&_span:has(>img)]:!h-10 [&_span:has(>img)]:!w-14"
              : "shrink-0 [&_span:has(>img)]:!my-0 [&_span:has(>img)]:!h-[4.25rem] [&_span:has(>img)]:!w-[8.25rem]"
          }
        />
        {!collapsed ? (
          <span className="ml-auto mr-8 rounded-md bg-admin-lime/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-admin-lime lg:mr-0">
            Vendor
          </span>
        ) : null}
      </div>
      <nav aria-label="Vendor navigation" tabIndex={0} className={`admin-sidebar-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain py-3 focus-visible:outline-none ${collapsed ? "px-2" : "px-3"}`}>
        <ul className="space-y-0.5">
          {links.map(({ href, label, icon: Icon, dividerBefore }) => {
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
            let badge: { count: number; title: string } | null = null;
            if (showPendingBadge) {
              badge = { count: pendingNew, title: `${pendingNew} new order(s) to process` };
            } else if (href === "/vendor/dashboard/notifications" && unreadNotifications > 0) {
              badge = { count: unreadNotifications, title: `${unreadNotifications} unread` };
            }
            return (
              <li key={href} className={dividerBefore ? "mt-2 border-t border-white/10 pt-2" : undefined}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? (badge ? `${label}, ${badge.title}` : label) : undefined}
                  title={collapsed ? label : undefined}
                  className={`relative flex min-h-[2.5rem] items-center gap-3 rounded-lg text-[14px] ${collapsed ? "justify-center px-0" : "px-3"} font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-admin-lime ${
                    active
                      ? "bg-admin-lime font-semibold text-admin-dark shadow-sm"
                      : "text-white/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
                  {!collapsed ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
                  {badge && collapsed ? (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-admin-lime ring-2 ring-admin-dark" aria-hidden />
                  ) : null}
                  {badge && !collapsed ? (
                    <span
                      className={`${badgeBase} ${active ? "bg-admin-dark text-admin-lime" : "bg-admin-lime text-admin-dark"}`}
                      title={badge.title}
                      aria-label={badge.title}
                    >
                      {badge.count > 99 ? "99+" : badge.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={`shrink-0 border-t border-white/10 py-3 ${collapsed ? "px-2" : "px-3"}`}>
        <LoadingButton
          type="button"
          loadingLabel="Signing out…" onClick={() => logout()}
          aria-label={collapsed ? "Logout" : undefined}
          title={collapsed ? "Logout" : undefined}
          className={`flex min-h-[2.5rem] w-full items-center gap-3 rounded-lg text-[14px] ${collapsed ? "justify-center px-0" : "px-3"} font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-lime`}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
          {!collapsed ? "Logout" : null}
        </LoadingButton>
      </div>
    </aside>
  );
}
