"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";

import Link from "@/components/ui/LoadingLink";
import { navigateDocument } from "@/lib/navigate-document";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Shapes,
  Settings,
  LogOut,
  Star,
  Store,
  Truck,
  Wallet,
  Percent,
  Bell,
  RotateCcw,
  ShieldCheck,
  Users,
  LifeBuoy,
  Sparkles,
  Wrench,
  MessageSquareHeart,
  Megaphone,
  TicketPercent,
  Trophy,
  Mail,
} from "lucide-react";
import { LogoMark } from "@/components/user/LogoMark";

const ADMIN_VENDORS_ACK_KEY = "admin_sidebar_vendors_ack";
const ADMIN_SELLER_ORDERS_ACK_KEY = "admin_sidebar_seller_orders_ack";
const ADMIN_APPEALS_ACK_KEY = "admin_sidebar_appeals_ack";

function readAck(key: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null || raw === "") return null;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeAck(key: string, n: number) {
  try {
    sessionStorage.setItem(key, JSON.stringify(n));
  } catch {
    /* ignore */
  }
}

function isAdminVendorsPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/admin/vendors" || pathname.startsWith("/admin/vendors/");
}

function isAdminSellerOrdersPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/admin/vendor-orders" ||
    pathname.startsWith("/admin/vendor-orders/")
  );
}

function isAdminNotificationsPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/admin/notifications" || pathname.startsWith("/admin/notifications/");
}

export const ADMIN_NAV_LINKS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package, dividerBefore: true },
  { href: "/admin/categories", label: "Categories", icon: Shapes },
  { href: "/admin/new-arrivals", label: "New Arrivals", icon: Sparkles },
  { href: "/admin/services", label: "Services", icon: Wrench },
  { href: "/admin/wants", label: "Wants", icon: MessageSquareHeart },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, dividerBefore: true },
  {
    href: "/admin/vendor-orders",
    label: "Seller orders",
    icon: Truck,
  },
  { href: "/admin/dashboard/after-sales", label: "After-sales", icon: RotateCcw },
  { href: "/admin/vendors", label: "Vendors", icon: Store, dividerBefore: true },
  { href: "/admin/vendors/top-vendors", label: "Top Vendors", icon: Trophy },
  { href: "/admin/vendor-promotions", label: "Vendor Promotions", icon: Megaphone },
  { href: "/admin/marketing/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/admin/marketing/email-campaigns", label: "Email Campaigns", icon: Mail },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  {
    href: "/admin/dashboard/payouts",
    label: "Payouts",
    icon: Wallet,
    dividerBefore: true,
  },
  {
    href: "/admin/dashboard/commission-settings",
    label: "Commission",
    icon: Percent,
  },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/dashboard/team", label: "Admin Team", icon: ShieldCheck, dividerBefore: true },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const links = ADMIN_NAV_LINKS;

/** Existing admin logout: end the NextAuth admin session, then hard-navigate to login. */
export async function signOutAdmin() {
  await signOut({ redirect: false });
  await navigateDocument("/admin/login");
}

export function isAdminLinkActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  // Keep dashboard exact so nested dashboard tools highlight their own links only.
  if (href === "/admin/dashboard") {
    return pathname === "/admin/dashboard";
  }
  return pathname === href || pathname.startsWith(href + "/");
}

/** The single nav item to highlight: the most specific link matching the path. */
export function activeAdminHref(pathname: string | null): string | null {
  let best: string | null = null;
  for (const { href } of ADMIN_NAV_LINKS) {
    if (isAdminLinkActive(pathname, href) && (!best || href.length > best.length)) best = href;
  }
  return best;
}

const badgeBase =
  "ml-auto min-w-[1.375rem] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold leading-4 tabular-nums";

export function AdminSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [pendingVendors, setPendingVendors] = useState(0);
  const [pendingSellerOrders, setPendingSellerOrders] = useState(0);
  const [pendingAppeals, setPendingAppeals] = useState(0);
  const [vendorsAck, setVendorsAck] = useState<number | null>(() =>
    typeof window !== "undefined" ? readAck(ADMIN_VENDORS_ACK_KEY) : null
  );
  const [sellerOrdersAck, setSellerOrdersAck] = useState<number | null>(() =>
    typeof window !== "undefined" ? readAck(ADMIN_SELLER_ORDERS_ACK_KEY) : null
  );
  const [appealsAck, setAppealsAck] = useState<number | null>(() =>
    typeof window !== "undefined" ? readAck(ADMIN_APPEALS_ACK_KEY) : null
  );

  useEffect(() => {
    fetch("/api/orders", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("orders failed"))))
      .then((data: { unread?: number }) => {
        setUnreadOrders(Number(data.unread || 0));
      })
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    let vAck = readAck(ADMIN_VENDORS_ACK_KEY);
    let sAck = readAck(ADMIN_SELLER_ORDERS_ACK_KEY);
    let aAck = readAck(ADMIN_APPEALS_ACK_KEY);
    setVendorsAck(vAck);
    setSellerOrdersAck(sAck);
    setAppealsAck(aAck);

    fetch("/api/admin/sidebar-badges", { credentials: "same-origin" })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("sidebar-badges failed"))
      )
      .then(
        (data: {
          pendingVendors?: number;
          pendingSellerOrders?: number;
          pendingAppeals?: number;
        }) => {
          if (cancelled) return;
          const pv = Number(data.pendingVendors ?? 0);
          const pso = Number(data.pendingSellerOrders ?? 0);
          const pa = Number(data.pendingAppeals ?? 0);
          const vendors = Number.isFinite(pv) ? pv : 0;
          const sellerOrds = Number.isFinite(pso) ? pso : 0;
          const appeals = Number.isFinite(pa) ? pa : 0;

          if (vAck != null && vendors < vAck) {
            vAck = vendors;
            writeAck(ADMIN_VENDORS_ACK_KEY, vendors);
          }
          if (isAdminVendorsPath(pathname)) {
            vAck = vendors;
            writeAck(ADMIN_VENDORS_ACK_KEY, vendors);
          }

          if (sAck != null && sellerOrds < sAck) {
            sAck = sellerOrds;
            writeAck(ADMIN_SELLER_ORDERS_ACK_KEY, sellerOrds);
          }
          if (isAdminSellerOrdersPath(pathname)) {
            sAck = sellerOrds;
            writeAck(ADMIN_SELLER_ORDERS_ACK_KEY, sellerOrds);
          }
          if (aAck != null && appeals < aAck) {
            aAck = appeals;
            writeAck(ADMIN_APPEALS_ACK_KEY, appeals);
          }
          if (isAdminNotificationsPath(pathname)) {
            aAck = appeals;
            writeAck(ADMIN_APPEALS_ACK_KEY, appeals);
          }

          setPendingVendors(vendors);
          setPendingSellerOrders(sellerOrds);
          setPendingAppeals(appeals);
          setVendorsAck(vAck);
          setSellerOrdersAck(sAck);
          setAppealsAck(aAck);
        }
      )
      .catch(() => {
        if (!cancelled) {
          setPendingVendors(0);
          setPendingSellerOrders(0);
          setPendingAppeals(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const activeHref = activeAdminHref(pathname);

  return (
    <aside className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-admin-dark text-white">
      <div
        className={`flex shrink-0 items-center border-b border-white/10 ${
          collapsed ? "justify-center px-2 py-3" : "gap-2 px-4 py-2"
        }`}
      >
        {/* Shared brand mark with the customer navbar; sized down so it fits the rail. */}
        <LogoMark
          inverse
          href="/admin/dashboard"
          className={
            collapsed
              ? "[&_span:has(>img)]:!m-0 [&_span:has(>img)]:!h-10 [&_span:has(>img)]:!w-14"
              : "[&_span:has(>img)]:!my-0 [&_span:has(>img)]:!h-[4.25rem] [&_span:has(>img)]:!w-[8.25rem]"
          }
        />
        {!collapsed ? (
          <span className="ml-auto mr-8 rounded-md bg-admin-lime/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-admin-lime md:mr-0">
            Admin
          </span>
        ) : null}
      </div>
      <nav
        aria-label="Admin navigation"
        className={`admin-sidebar-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain py-3 ${
          collapsed ? "px-2" : "px-3"
        }`}
      >
        <ul className="space-y-0.5">
          {links.map(({ href, label, icon: Icon, dividerBefore }) => {
            const onVendors = isAdminVendorsPath(pathname);
            const onSellerOrders = isAdminSellerOrdersPath(pathname);
            const vendorsNew =
              vendorsAck == null
                ? pendingVendors
                : Math.max(0, pendingVendors - vendorsAck);
            const sellerOrdersNew =
              sellerOrdersAck == null
                ? pendingSellerOrders
                : Math.max(0, pendingSellerOrders - sellerOrdersAck);
            const showVendorsBadge =
              href === "/admin/vendors" && vendorsNew > 0 && !onVendors;
            const showSellerOrdersBadge =
              href === "/admin/vendor-orders" &&
              sellerOrdersNew > 0 &&
              !onSellerOrders;
            const onNotifications = isAdminNotificationsPath(pathname);
            const appealsNew =
              appealsAck == null ? pendingAppeals : Math.max(0, pendingAppeals - appealsAck);
            const showAppealsBadge =
              href === "/admin/notifications" && appealsNew > 0 && !onNotifications;

            const active = href === activeHref;
            let badge: { count: number; title: string } | null = null;
            if (href === "/admin/orders" && unreadOrders > 0) {
              badge = { count: unreadOrders, title: `${unreadOrders} unread order(s)` };
            } else if (showVendorsBadge) {
              badge = { count: vendorsNew, title: `${vendorsNew} new vendor signup(s)` };
            } else if (showSellerOrdersBadge) {
              badge = { count: sellerOrdersNew, title: `${sellerOrdersNew} new seller order(s)` };
            } else if (showAppealsBadge) {
              badge = { count: appealsNew, title: `${appealsNew} unresolved appeal(s)` };
            }

            return (
              <li
                key={href}
                className={dividerBefore ? "mt-2 border-t border-white/10 pt-2" : undefined}
              >
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? (badge ? `${label}, ${badge.title}` : label) : undefined}
                  title={collapsed ? label : undefined}
                  className={`relative flex min-h-[2.5rem] items-center gap-3 rounded-lg text-[14px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-admin-lime ${
                    collapsed ? "justify-center px-0" : "px-3"
                  } ${
                    active
                      ? "bg-admin-lime font-semibold text-admin-dark shadow-sm"
                      : "text-white/85 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
                  {!collapsed ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
                  {badge && !collapsed ? (
                    <span
                      className={`${badgeBase} ${
                        active ? "bg-admin-dark text-admin-lime" : "bg-admin-lime text-admin-dark"
                      }`}
                      title={badge.title}
                    >
                      {badge.count > 99 ? "99+" : badge.count}
                    </span>
                  ) : null}
                  {badge && collapsed ? (
                    <span
                      className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-admin-lime ring-2 ring-admin-dark"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={`shrink-0 border-t border-white/10 py-3 ${collapsed ? "px-2" : "px-3"}`}>
        <LoadingButton loadingLabel="Processing…"
          type="button"
          onClick={signOutAdmin}
          aria-label={collapsed ? "Log out" : undefined}
          title={collapsed ? "Log out" : undefined}
          className={`flex min-h-[2.5rem] w-full items-center gap-3 rounded-lg text-[14px] font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-lime ${
            collapsed ? "justify-center px-0" : "px-3"
          }`}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden />
          {!collapsed ? "Log out" : null}
        </LoadingButton>
      </div>
    </aside>
  );
}
