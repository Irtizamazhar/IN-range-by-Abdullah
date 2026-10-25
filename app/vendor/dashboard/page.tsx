import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { redirect } from "next/navigation";
import { VendorShopOrderStatus } from "@prisma/client";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { prisma } from "@/lib/prisma";
import { formatPKR } from "@/lib/format";
import { getVendorShopStats } from "@/lib/vendor-shop-order-stats";
import { sumPendingEarningsNet } from "@/lib/vendor-earning-service";
import { parseImagesJson } from "@/lib/vendor-product-schemas";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";
import { vendorWelcomeDisplayName } from "@/lib/vendor-display-name";
import { SalesOverviewChart, type SalesPoint } from "@/components/admin/dashboard/SalesOverviewChart";
import { SalesRangeSelect } from "@/components/vendor/dashboard/SalesRangeSelect";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Box,
  ChevronRight,
  Clock,
  ExternalLink,
  Landmark,
  Package,
  Plus,
  ShoppingCart,
  Tag,
  Wallet,
} from "lucide-react";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
/** Display-only cut-off for the "running low" card; the catalog has no per-product threshold. */
const LOW_STOCK_UNITS = 5;

type RecentRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  city: string;
  productName: string;
  extraItems: number;
  image: string | null;
  amount: number;
  status: string;
  dateLabel: string;
};

type TopProduct = { id: string; name: string; price: number; sold: number; image: string | null };

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "delivered") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (s === "pending") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (s === "cancelled") return "bg-red-50 text-red-700 ring-red-200";
  if (s === "shipped") return "bg-sky-50 text-sky-800 ring-sky-200";
  if (s === "confirmed" || s === "packed") return "bg-indigo-50 text-indigo-700 ring-indigo-200";
  return "bg-[#EAF4EC] text-admin-primary ring-[#CFE3D5]";
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildSeries(rows: { placedAt: Date; totalAmount: unknown; status: string }[], days: number, now: Date): SalesPoint[] {
  const dayFmt = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short" });
  const dayFull = new Intl.DateTimeFormat("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const first = startOfDay(now).getTime() - (days - 1) * DAY;
  const points = Array.from({ length: days }, (_, i) => {
    const d = new Date(first + i * DAY);
    return { label: dayFmt.format(d), fullLabel: dayFull.format(d), value: 0, orders: 0 };
  });
  for (const r of rows) {
    if (r.status === VendorShopOrderStatus.cancelled) continue;
    const i = Math.floor((startOfDay(r.placedAt).getTime() - first) / DAY);
    if (i < 0 || i >= days) continue;
    points[i].orders += 1;
    points[i].value += Number(r.totalAmount);
  }
  return points;
}

function firstItem(items: unknown): { name: string; vendorProductId: string | null; count: number } {
  const list = Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
  const head = list[0] ?? {};
  return {
    name: typeof head.productName === "string" && head.productName ? head.productName : "Order items",
    vendorProductId: typeof head.vendorProductId === "string" ? head.vendorProductId : null,
    count: list.length,
  };
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-admin-border bg-admin-bg">
      {src ? (
        <Image src={src} alt={alt} fill sizes="40px" className="object-cover" unoptimized={shouldUnoptimizeImageSrc(src)} />
      ) : (
        <Package className="h-5 w-5 text-admin-muted" aria-hidden />
      )}
    </span>
  );
}

/** Same card surface as the admin dashboard. */
const card = "rounded-2xl border border-admin-border bg-white shadow-[0_1px_2px_rgba(0,61,43,0.04),0_8px_24px_rgba(0,61,43,0.05)]";

export default async function VendorDashboardPage({
  searchParams,
}: {
  searchParams?: { range?: string };
}) {
  const row = await getVendorFromSession({ allowUnapproved: true });
  if (!row) {
    redirect("/vendor/login");
  }
  const v = row.vendor;
  const approved = v.status === "approved";
  const range = searchParams?.range === "30d" ? "30d" : "7d";
  const rangeDays = range === "30d" ? 30 : 7;
  const now = new Date();

  let openShopBundles = 0;
  let revenue = 0;
  let productCount = 0;
  let recent: RecentRow[] = [];
  let shopStats = {
    ordersToday: 0,
    pending: 0,
    shipped: 0,
    cancelled: 0,
  };
  let totalOrders = 0;
  let ordersLast7 = 0;
  let ordersPrev7 = 0;
  let availableBalance = 0;
  let lowStock = 0;
  let topProducts: TopProduct[] = [];
  let series: SalesPoint[] = [];
  let storeSlug: string | null = null;

  if (approved) {
    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const twoWeeksAgo = new Date(now.getTime() - 14 * DAY);
    const seriesStart = new Date(startOfDay(now).getTime() - (rangeDays - 1) * DAY);
    const [
      productCountRes,
      deliveredLines,
      recentShops,
      stats,
      openBundles,
      totalOrdersRes,
      last7,
      prev7,
      balance,
      lowStockRes,
      topRes,
      seriesRows,
      vendorRow,
    ] = await Promise.all([
      prisma.vendorProduct.count({ where: { vendorId: v.id } }),
      prisma.vendorOrder.findMany({
        where: { vendorId: v.id, status: "delivered" },
        select: { vendorAmount: true },
      }),
      prisma.vendorShopOrder.findMany({
        where: { vendorId: v.id },
        orderBy: { placedAt: "desc" },
        take: 5,
        select: {
          id: true,
          shopOrderNumber: true,
          customerName: true,
          city: true,
          items: true,
          totalAmount: true,
          status: true,
          placedAt: true,
        },
      }),
      getVendorShopStats(v.id),
      prisma.vendorShopOrder.count({
        where: {
          vendorId: v.id,
          status: {
            notIn: [
              VendorShopOrderStatus.delivered,
              VendorShopOrderStatus.cancelled,
            ],
          },
        },
      }),
      prisma.vendorShopOrder.count({ where: { vendorId: v.id } }),
      prisma.vendorShopOrder.count({ where: { vendorId: v.id, placedAt: { gte: weekAgo } } }),
      prisma.vendorShopOrder.count({ where: { vendorId: v.id, placedAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
      sumPendingEarningsNet(v.id),
      prisma.vendorProduct.count({ where: { vendorId: v.id, status: "active", stock: { lte: LOW_STOCK_UNITS } } }),
      prisma.vendorProduct.findMany({
        where: { vendorId: v.id, totalSold: { gt: 0 } },
        orderBy: { totalSold: "desc" },
        take: 3,
        select: { id: true, productName: true, price: true, images: true, totalSold: true },
      }),
      prisma.vendorShopOrder.findMany({
        where: { vendorId: v.id, placedAt: { gte: seriesStart } },
        select: { placedAt: true, totalAmount: true, status: true },
      }),
      prisma.vendor.findUnique({ where: { id: v.id }, select: { storeSlug: true } }),
    ]);
    productCount = productCountRes;
    openShopBundles = openBundles;
    revenue = deliveredLines.reduce(
      (s, o) => s + Number(o.vendorAmount),
      0
    );
    shopStats = stats;
    totalOrders = totalOrdersRes;
    ordersLast7 = last7;
    ordersPrev7 = prev7;
    availableBalance = balance;
    lowStock = lowStockRes;
    storeSlug = vendorRow?.storeSlug ?? null;
    series = buildSeries(seriesRows, rangeDays, now);
    topProducts = topRes.map((p) => ({
      id: p.id,
      name: p.productName,
      price: Number(p.price),
      sold: p.totalSold,
      image: parseImagesJson(p.images)[0] ?? null,
    }));

    const heads = recentShops.map((r) => firstItem(r.items));
    const ids = Array.from(new Set(heads.map((h) => h.vendorProductId).filter((x): x is string => !!x)));
    const imgRows = ids.length
      ? await prisma.vendorProduct.findMany({ where: { id: { in: ids }, vendorId: v.id }, select: { id: true, images: true } })
      : [];
    const imageById = new Map(imgRows.map((p) => [p.id, parseImagesJson(p.images)[0] ?? null]));
    recent = recentShops.map((r, i) => ({
      id: r.id,
      orderNumber: r.shopOrderNumber,
      customerName: r.customerName,
      city: r.city,
      productName: heads[i].name,
      extraItems: Math.max(0, heads[i].count - 1),
      image: heads[i].vendorProductId ? imageById.get(heads[i].vendorProductId) ?? null : null,
      amount: Number(r.totalAmount),
      status: r.status,
      dateLabel: r.placedAt.toLocaleDateString("en-PK"),
    }));
  }

  const orderTrend =
    ordersPrev7 > 0 ? Math.round(((ordersLast7 - ordersPrev7) / ordersPrev7) * 100) : null;

  const kpis = [
    { label: "Total Earnings", value: formatPKR(revenue), hint: "From delivered line items", icon: ShoppingCart, href: "/vendor/dashboard/earnings" },
    { label: "Orders", value: String(totalOrders), hint: `${ordersLast7} in the last 7 days`, trend: orderTrend, icon: Box, href: "/vendor/dashboard/orders" },
    { label: "My Products", value: String(productCount), hint: "Active catalog SKUs", icon: Tag, href: "/vendor/dashboard/products" },
    { label: "Pending Orders", value: String(shopStats.pending), hint: "Needs your action", icon: Clock, href: "/vendor/dashboard/orders?status=pending" },
  ];

  const hub = [
    { label: "Orders today", value: shopStats.ordersToday, href: "/vendor/dashboard/orders" },
    { label: "Open shop orders", value: openShopBundles, href: "/vendor/dashboard/orders" },
    { label: "Shipped", value: shopStats.shipped, href: "/vendor/dashboard/orders?status=shipped" },
    { label: "Cancelled", value: shopStats.cancelled, href: "/vendor/dashboard/orders?status=cancelled" },
  ];

  const sectionHead = "flex flex-wrap items-center justify-between gap-3 border-b border-admin-border px-4 py-3.5 sm:px-5 sm:py-4";
  const viewAll = "inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-admin-primary hover:underline";
  const secondaryButton = "inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-admin-border bg-white px-4 text-sm font-semibold text-admin-primary transition-colors hover:bg-admin-bg sm:flex-none";

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-admin-ink">Vendor Dashboard</h1>
          <p className="mt-1 text-sm text-admin-muted">
            Welcome back, <span className="font-semibold text-admin-primary">{vendorWelcomeDisplayName(v.ownerName)}</span>. Here&apos;s how your store is doing today.
          </p>
        </div>
        {approved ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {storeSlug ? (
              <a href={`/stores/${encodeURIComponent(storeSlug)}`} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
                <ExternalLink className="h-4 w-4" aria-hidden />
                View Store
              </a>
            ) : (
              <Link href="/vendor/dashboard/store" className={secondaryButton}>
                <ExternalLink className="h-4 w-4" aria-hidden />
                Set up store
              </Link>
            )}
            <Link
              href="/vendor/dashboard/products/new"
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-admin-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-admin-dark sm:flex-none"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add Product
            </Link>
          </div>
        ) : null}
      </div>

      {!approved ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Your account is <strong>{v.status}</strong>. You can browse this
          panel, but orders and catalog tools unlock after admin approval.
        </div>
      ) : null}

      <section aria-label="Summary" className="mb-6 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, hint, trend, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className={`${card} group flex min-w-0 items-start gap-4 p-5 transition-colors hover:border-admin-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-primary`}
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EC] text-admin-primary">
              <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden />
            </span>
            {/* Size container: the value scales with the card width (1rem-1.5rem) so long PKR amounts stay whole. */}
            <div className="min-w-0 flex-1 [container-type:inline-size]">
              <p className="flex items-start justify-between gap-2 text-sm font-medium text-admin-muted">
                <span className="min-w-0 break-words">{label}</span>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-admin-muted/50 transition-colors group-hover:text-admin-primary" aria-hidden />
              </p>
              <p className="mt-1 text-[clamp(1rem,10cqi,1.5rem)] font-bold leading-tight tracking-tight tabular-nums text-admin-ink [overflow-wrap:anywhere]">{value}</p>
              <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-snug text-admin-muted">
                {trend != null ? (
                  <span className={`inline-flex shrink-0 items-center gap-0.5 font-semibold ${trend >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {trend >= 0 ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
                    {Math.abs(trend)}%
                  </span>
                ) : null}
                <span className="min-w-0 break-words">{trend != null ? "vs. previous 7 days" : hint}</span>
              </p>
            </div>
          </Link>
        ))}
      </section>

      {approved ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,23.5rem)]">
          {/* Sales overview */}
          <section className={`${card} min-w-0 overflow-hidden`} aria-labelledby="sales-heading">
            <div className={sectionHead}>
              <div className="min-w-0">
                <h2 id="sales-heading" className="text-base font-bold text-admin-ink">Sales Overview</h2>
                <p className="text-xs text-admin-muted">Order value for the last {rangeDays} days · PKR</p>
              </div>
              <SalesRangeSelect value={range} />
            </div>
            <div className="p-4 sm:p-5">
              <SalesOverviewChart points={series} />
            </div>
            <div className="grid grid-cols-2 border-t border-admin-border sm:grid-cols-4">
              {hub.map((h, i) => (
                <Link
                  key={h.label}
                  href={h.href}
                  className={`min-w-0 px-4 py-3 transition-colors hover:bg-admin-bg sm:px-5 ${i % 2 ? "border-l border-admin-border" : ""} ${i > 1 ? "border-t border-admin-border sm:border-t-0" : ""} ${i === 2 ? "sm:border-l sm:border-admin-border" : ""}`}
                >
                  <p className="break-words text-xs font-medium leading-snug text-admin-muted">{h.label}</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-admin-ink">{h.value}</p>
                </Link>
              ))}
            </div>
          </section>

          {/* Balance + stock */}
          <div className="grid min-w-0 grid-cols-1 content-start gap-4 md:grid-cols-2 xl:grid-cols-1">
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-admin-primary to-admin-dark p-5 text-white shadow-[0_8px_24px_rgba(0,61,43,0.18)]" aria-labelledby="balance-heading">
              <svg className="pointer-events-none absolute -right-6 bottom-0 h-40 w-56 text-white/[0.06]" viewBox="0 0 200 140" aria-hidden>
                <path d="M0 140 L120 0 L200 0 L200 140 Z" fill="currentColor" />
                <path d="M60 140 L170 10 L200 10 L200 140 Z" fill="currentColor" />
              </svg>
              <div className="relative flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-admin-lime">
                  <Wallet className="h-5 w-5" aria-hidden />
                </span>
                <h2 id="balance-heading" className="text-sm font-semibold uppercase tracking-[0.12em] text-white/80">Available Balance</h2>
              </div>
              <p className="relative mt-4 break-words text-3xl font-bold leading-tight tracking-tight tabular-nums">{formatPKR(availableBalance)}</p>
              <p className="relative mt-0.5 text-sm text-white/70">Earnings after deductions</p>
              <Link
                href="/vendor/dashboard/withdrawals"
                className="relative mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-admin-lime text-sm font-bold text-admin-dark transition-colors hover:bg-[#a3d328]"
              >
                <Landmark className="h-4 w-4" aria-hidden />
                Withdraw
              </Link>
            </section>

            <section className={`${card} p-5`} aria-labelledby="stock-heading">
              <Link href="/vendor/dashboard/products" className="group flex items-start gap-3 rounded-lg">
                <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${lowStock > 0 ? "bg-amber-50 text-amber-700" : "bg-[#EAF4EC] text-admin-primary"}`}>
                  <Box className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span id="stock-heading" className="block text-sm font-bold text-admin-ink">
                    {lowStock > 0 ? `${lowStock} product${lowStock === 1 ? "" : "s"} running low` : "Stock levels look good"}
                  </span>
                  <span className="mt-0.5 block text-xs text-admin-muted">
                    {lowStock > 0 ? `${LOW_STOCK_UNITS} or fewer units left in stock.` : `No active product has ${LOW_STOCK_UNITS} or fewer units.`}
                  </span>
                </span>
                <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-admin-muted transition-colors group-hover:text-admin-primary" aria-hidden />
              </Link>
              <Link
                href="/vendor/dashboard/products"
                className="mt-4 flex h-10 items-center justify-center rounded-xl border border-admin-border text-sm font-semibold text-admin-primary transition-colors hover:bg-admin-bg"
              >
                Manage inventory
              </Link>
            </section>
          </div>

          {/* Recent orders */}
          <section className={`${card} min-w-0 overflow-hidden`} aria-labelledby="recent-heading">
            <div className={sectionHead}>
              <div className="min-w-0">
                <h2 id="recent-heading" className="text-base font-bold text-admin-ink">Recent Orders</h2>
                <p className="text-xs text-admin-muted">Latest orders from your store</p>
              </div>
              <Link href="/vendor/dashboard/orders" className={viewAll}>
                View all <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-admin-bg text-xs font-semibold uppercase tracking-wide text-admin-muted">
                  <tr>
                    <th className="px-5 py-3">Order#</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-admin-muted">
                        No orders yet containing your products.
                      </td>
                    </tr>
                  ) : (
                    recent.map((r) => (
                      <tr key={r.id} className="border-t border-admin-border transition-colors hover:bg-admin-bg/60">
                        <td className="whitespace-nowrap px-5 py-3 align-middle">
                          <Link href={`/vendor/dashboard/orders/${r.id}`} className="font-semibold text-admin-primary hover:underline">
                            #{r.orderNumber}
                          </Link>
                          <p className="text-xs text-admin-muted">{r.dateLabel}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <Thumb src={r.image} alt={r.productName} />
                            <div className="min-w-0">
                              <p className="max-w-[14rem] truncate font-medium text-admin-ink" title={r.productName}>{r.productName}</p>
                              {r.extraItems > 0 ? (
                                <p className="text-xs text-admin-muted">+{r.extraItems} more item{r.extraItems === 1 ? "" : "s"}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[10rem] truncate font-medium text-admin-ink" title={r.customerName}>{r.customerName}</p>
                          <p className="text-xs text-admin-muted">{r.city}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-admin-ink">{formatPKR(r.amount)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusBadgeClass(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          <Link
                            href={`/vendor/dashboard/orders/${r.id}`}
                            aria-label={`Open order ${r.orderNumber}`}
                            className="inline-flex h-8 items-center rounded-lg border border-admin-border px-3 text-xs font-semibold text-admin-primary hover:bg-admin-bg"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Top products */}
          <section className={`${card} min-w-0 overflow-hidden`} aria-labelledby="top-heading">
            <div className={sectionHead}>
              <div className="min-w-0">
                <h2 id="top-heading" className="text-base font-bold text-admin-ink">Top Products</h2>
                <p className="text-xs text-admin-muted">Best performing products</p>
              </div>
              <Link href="/vendor/dashboard/products" className={viewAll}>
                View all <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            {topProducts.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-admin-muted">No product sales yet.</p>
            ) : (
              <ul className="divide-y divide-admin-border">
                {topProducts.map((p, i) => (
                  <li key={p.id}>
                    <Link href={`/vendor/dashboard/products/${p.id}/edit`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-admin-bg/60 sm:px-5">
                      <span className="w-4 shrink-0 text-center text-xs font-bold tabular-nums text-admin-muted">{i + 1}</span>
                      <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-admin-border bg-admin-bg">
                        {p.image ? (
                          <Image src={p.image} alt={p.name} fill sizes="48px" className="object-cover" unoptimized={shouldUnoptimizeImageSrc(p.image)} />
                        ) : (
                          <Package className="h-5 w-5 text-admin-muted" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 break-words text-sm font-medium text-admin-ink" title={p.name}>{p.name}</span>
                        <span className="block text-xs text-admin-muted">{formatPKR(p.price)}</span>
                      </span>
                      <span className="shrink-0 rounded-lg bg-[#EAF4EC] px-2.5 py-1 text-right">
                        <span className="block text-sm font-bold leading-tight tabular-nums text-admin-primary">{p.sold}</span>
                        <span className="block text-[10px] font-medium uppercase tracking-wide text-admin-muted">sold</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
