"use client";

import Link from "next/link";
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
} from "lucide-react";
import { LogoMark } from "@/components/user/LogoMark";

const ADMIN_VENDORS_ACK_KEY = "admin_sidebar_vendors_ack";
const ADMIN_SELLER_ORDERS_ACK_KEY = "admin_sidebar_seller_orders_ack";

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

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/new-arrivals", label: "New Arrivals", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Shapes },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  {
    href: "/admin/vendor-orders",
    label: "Seller orders",
    icon: Truck,
  },
  { href: "/admin/vendors", label: "Vendors", icon: Store },
  {
    href: "/admin/dashboard/payouts",
    label: "Payouts",
    icon: Wallet,
  },
  {
    href: "/admin/dashboard/commission-settings",
    label: "Commission",
    icon: Percent,
  },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [pendingVendors, setPendingVendors] = useState(0);
  const [pendingSellerOrders, setPendingSellerOrders] = useState(0);
  const [vendorsAck, setVendorsAck] = useState<number | null>(() =>
    typeof window !== "undefined" ? readAck(ADMIN_VENDORS_ACK_KEY) : null
  );
  const [sellerOrdersAck, setSellerOrdersAck] = useState<number | null>(() =>
    typeof window !== "undefined" ? readAck(ADMIN_SELLER_ORDERS_ACK_KEY) : null
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
    setVendorsAck(vAck);
    setSellerOrdersAck(sAck);

    fetch("/api/admin/sidebar-badges", { credentials: "same-origin" })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("sidebar-badges failed"))
      )
      .then(
        (data: {
          pendingVendors?: number;
          pendingSellerOrders?: number;
        }) => {
          if (cancelled) return;
          const pv = Number(data.pendingVendors ?? 0);
          const pso = Number(data.pendingSellerOrders ?? 0);
          const vendors = Number.isFinite(pv) ? pv : 0;
          const sellerOrds = Number.isFinite(pso) ? pso : 0;

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

          setPendingVendors(vendors);
          setPendingSellerOrders(sellerOrds);
          setVendorsAck(vAck);
          setSellerOrdersAck(sAck);
        }
      )
      .catch(() => {
        if (!cancelled) {
          setPendingVendors(0);
          setPendingSellerOrders(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <aside className="w-64 shrink-0 bg-footerDark text-white min-h-screen flex flex-col">
      <div className="p-4 border-b border-white/10">
        {/* Same /logo.png and default sizing as customer Navbar */}
        <LogoMark
          href="/admin/dashboard"
          className="shrink-0 [&_img]:max-w-[min(100%,260px)]"
        />
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-primaryYellow">
          Admin
        </p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
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

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-all duration-200 ${
                pathname != null &&
                (pathname === href || pathname.startsWith(href + "/"))
                  ? "bg-[#1BACE4] font-semibold text-white shadow-sm"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {href === "/admin/orders" && unreadOrders > 0 ? (
                <span className="ml-auto min-w-[1.25rem] rounded-full bg-red-500 px-2 py-0.5 text-center text-[11px] font-bold text-white tabular-nums">
                  {unreadOrders > 99 ? "99+" : unreadOrders}
                </span>
              ) : null}
              {showVendorsBadge ? (
                <span
                  className="ml-auto min-w-[1.25rem] rounded-full bg-red-500 px-2 py-0.5 text-center text-[11px] font-bold text-white tabular-nums"
                  title={`${vendorsNew} new vendor signup(s)`}
                >
                  {vendorsNew > 99 ? "99+" : vendorsNew}
                </span>
              ) : null}
              {showSellerOrdersBadge ? (
                <span
                  className="ml-auto min-w-[1.25rem] rounded-full bg-red-500 px-2 py-0.5 text-center text-[11px] font-bold text-white tabular-nums"
                  title={`${sellerOrdersNew} new seller order(s)`}
                >
                  {sellerOrdersNew > 99 ? "99+" : sellerOrdersNew}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <button
          type="button"
          onClick={() =>
            signOut({ callbackUrl: "/admin/login" })
          }
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
