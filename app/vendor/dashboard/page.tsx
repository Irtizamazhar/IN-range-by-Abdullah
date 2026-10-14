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
  ArrowUp,
  BarChart3,
  Box,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Landmark,
  MoreVertical,
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
  if (s === "delivered") return "bg-green-100 text-green-700";
  if (s === "pending") return "bg-amber-100 text-amber-800";
  if (s === "cancelled") return "bg-red-100 text-red-700";
  if (s === "shipped") return "bg-emerald-100 text-emerald-800";
  if (s === "confirmed" || s === "packed") return "bg-sky-100 text-sky-700";
  return "bg-brand-soft text-brand-dark";
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
    <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-admin-border bg-admin-bg">
      {src ? (
        <Image src={src} alt={alt} fill sizes="48px" className="object-cover" unoptimized={shouldUnoptimizeImageSrc(src)} />
      ) : (
        <Package className="h-5 w-5 text-admin-muted" aria-hidden />
      )}
    </span>
  );
}

const card = "rounded-2xl border border-admin-border bg-white shadow-[0_1px_2px_rgba(16,42,32,0.04)]";

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
    { label: "Total Earnings", value: formatPKR(revenue), hint: "From delivered line items", icon: ShoppingCart, chip: "bg-admin-lime/25 text-admin-primary", href: "/vendor/dashboard/earnings" },
    { label: "Orders", value: String(totalOrders), hint: `${ordersLast7} in the last 7 days`, trend: orderTrend, icon: Box, chip: "bg-sky-100 text-sky-600", href: "/vendor/dashboard/orders" },
    { label: "My Products", value: String(productCount), hint: "Active catalog SKUs", icon: Tag, chip: "bg-violet-100 text-violet-600", href: "/vendor/dashboard/products" },
    { label: "Pending Orders", value: String(shopStats.pending), hint: "Needs your action", icon: Clock, chip: "bg-amber-100 text-amber-600", href: "/vendor/dashboard/orders?status=pending" },
  ];

  const hub = [
    { label: "Orders today", value: shopStats.ordersToday, href: "/vendor/dashboard/orders" },
    { label: "Open shop orders", value: openShopBundles, href: "/vendor/dashboard/orders" },
    { label: "Shipped", value: shopStats.shipped, href: "/vendor/dashboard/orders?status=shipped" },
    { label: "Cancelled", value: shopStats.cancelled, href: "/vendor/dashboard/orders?status=cancelled" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.9rem] font-extrabold leading-tight tracking-tight text-admin-ink sm:text-[2.5rem]">
            Vendor Dashboard
          </h1>
          <p className="mt-0.5 text-xl font-bold text-admin-ink sm:text-2xl">
            Welcome back,{" "}
            <span className="text-admin-primary">{vendorWelcomeDisplayName(v.ownerName)}</span>
          </p>
          <p className="mt-1 text-base text-admin-muted sm:text-[17px]">Here&apos;s how your store is doing today.</p>
        </div>
        {approved ? (
          <div className="flex w-full flex-wrap gap-3 sm:mt-2 sm:w-auto">
            <Link
              href="/vendor/dashboard/products/new"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-admin-primary px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-admin-dark sm:flex-none"
            >
              <Plus className="h-5 w-5" aria-hidden />
              Add Product
            </Link>
            {storeSlug ? (
              <a
                href={`/stores/${encodeURIComponent(storeSlug)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-admin-primary bg-white px-5 text-base font-semibold text-admin-primary transition-colors hover:bg-admin-bg sm:flex-none"
              >
                <ExternalLink className="h-5 w-5" aria-hidden />
                View Store
              </a>
            ) : (
              <Link
                href="/vendor/dashboard/store"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-admin-primary bg-white px-5 text-base font-semibold text-admin-primary transition-colors hover:bg-admin-bg sm:flex-none"
              >
                <ExternalLink className="h-5 w-5" aria-hidden />
                Set up store
              </Link>
            )}
          </div>
        ) : null}
      </div>

      {!approved ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Your account is <strong>{v.status}</strong>. You can browse this
          panel, but orders and catalog tools unlock after admin approval.
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:gap-5 xl:grid-cols-4">
        {kpis.map(({ label, value, hint, trend, icon: Icon, chip, href }) => (
          <Link
            key={label}
            href={href}
            className={`${card} relative flex min-w-0 items-center gap-4 p-5 transition hover:border-admin-primary/30 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-primary`}
          >
            <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${chip}`}>
              <Icon className="h-6 w-6" strokeWidth={1.9} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate pr-6 text-[15px] font-medium text-admin-ink">{label}</p>
              <p className="mt-0.5 truncate text-[1.65rem] font-extrabold leading-tight tabular-nums text-admin-ink">{value}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-admin-muted">
                {trend != null ? (
                  <span className={`inline-flex items-center gap-0.5 font-semibold ${trend >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {trend >= 0 ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />}
                    {Math.abs(trend)}%
                  </span>
                ) : null}
                <span className="truncate">{trend != null ? "vs. previous 7 days" : hint}</span>
              </p>
            </div>
            <BarChart3 className="absolute right-4 top-4 h-5 w-5 text-admin-muted/40" aria-hidden />
          </Link>
        ))}
      </div>

      {approved ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,23.5rem)]">
          {/* Sales overview */}
          <section className={`${card} min-w-0 p-5`} aria-labelledby="sales-heading">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-admin-lime/25 text-admin-primary">
                  <BarChart3 className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 id="sales-heading" className="text-lg font-bold text-admin-ink">Sales Overview</h2>
                  <p className="text-sm text-admin-muted">Order value for the last {rangeDays} days</p>
                </div>
              </div>
              <SalesRangeSelect value={range} />
            </div>
            <SalesOverviewChart points={series} />
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-admin-border pt-3 sm:grid-cols-4">
              {hub.map((h) => (
                <Link key={h.label} href={h.href} className="rounded-lg px-2 py-1.5 transition-colors hover:bg-admin-bg">
                  <p className="text-xs text-admin-muted">{h.label}</p>
                  <p className="text-lg font-bold tabular-nums text-admin-ink">{h.value}</p>
                </Link>
              ))}
            </div>
          </section>

          {/* Balance + stock */}
          <div className="grid min-w-0 grid-cols-1 content-start gap-5 md:grid-cols-2 xl:grid-cols-1">
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-admin-primary to-admin-dark p-5 text-white shadow-sm" aria-labelledby="balance-heading">
              <svg className="pointer-events-none absolute -right-6 bottom-0 h-40 w-56 text-white/[0.06]" viewBox="0 0 200 140" aria-hidden>
                <path d="M0 140 L120 0 L200 0 L200 140 Z" fill="currentColor" />
                <path d="M60 140 L170 10 L200 10 L200 140 Z" fill="currentColor" />
              </svg>
              <div className="relative flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                  <Wallet className="h-5 w-5" aria-hidden />
                </span>
                <h2 id="balance-heading" className="text-lg font-semibold">Available Balance</h2>
              </div>
              <p className="relative mt-4 break-words text-[2.2rem] font-extrabold leading-tight tabular-nums">{formatPKR(availableBalance)}</p>
              <p className="relative text-[15px] text-white/75">Earnings after deductions</p>
              <Link
                href="/vendor/dashboard/withdrawals"
                className="relative mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-admin-lime text-base font-bold text-admin-dark transition-colors hover:bg-[#a3d328]"
              >
                <Landmark className="h-5 w-5" aria-hidden />
                Withdraw
              </Link>
            </section>

            <section className={`${card} p-4`} aria-labelledby="stock-heading">
              <Link href="/vendor/dashboard/products" className="flex items-start gap-3 rounded-lg">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Box className="h-6 w-6" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span id="stock-heading" className="block font-bold text-admin-ink">
                    {lowStock > 0 ? `${lowStock} product${lowStock === 1 ? "" : "s"} running low` : "Stock levels look good"}
                  </span>
                  <span className="block text-sm text-admin-muted">
                    {lowStock > 0 ? `${LOW_STOCK_UNITS} or fewer units left in stock.` : `No active product has ${LOW_STOCK_UNITS} or fewer units.`}
                  </span>
                </span>
                <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-admin-ink" aria-hidden />
              </Link>
              <Link
                href="/vendor/dashboard/products"
                className="mt-3 flex h-9 items-center justify-center rounded-lg bg-admin-lime/20 text-sm font-semibold text-admin-dark transition-colors hover:bg-admin-lime/35 sm:ml-[3.75rem]"
              >
                Manage inventory
              </Link>
            </section>
          </div>

          {/* Recent orders */}
          <section className={`${card} min-w-0 overflow-hidden`} aria-labelledby="recent-heading">
            <div className="flex items-center justify-between gap-3 p-5 pb-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-admin-lime/25 text-admin-primary">
                  <FileText className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 id="recent-heading" className="text-lg font-bold text-admin-ink">Recent Orders</h2>
                  <p className="text-sm text-admin-muted">Latest orders from your store</p>
                </div>
              </div>
              <Link href="/vendor/dashboard/orders" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-admin-primary hover:underline">
                View All <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="overflow-x-auto px-3 pb-3 sm:px-5 sm:pb-4">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-admin-bg text-[13px] text-admin-ink">
                  <tr>
                    <th className="rounded-l-lg px-3 py-2.5 font-semibold">Order ID</th>
                    <th className="px-3 py-2.5 font-semibold">Product</th>
                    <th className="px-3 py-2.5 font-semibold">Customer</th>
                    <th className="px-3 py-2.5 font-semibold">Amount</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="w-10 rounded-r-lg px-2 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-admin-muted">
                        No orders yet containing your products.
                      </td>
                    </tr>
                  ) : (
                    recent.map((r) => (
                      <tr key={r.id} className="border-b border-admin-border last:border-0">
                        <td className="px-3 py-2.5 align-middle">
                          <Link href={`/vendor/dashboard/orders/${r.id}`} className="font-semibold text-admin-ink hover:text-admin-primary hover:underline">
                            #{r.orderNumber}
                          </Link>
                          <p className="text-xs text-admin-muted">{r.dateLabel}</p>
                        </td>
                        <td className="px-3 py-2.5">
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
                        <td className="px-3 py-2.5">
                          <p className="max-w-[10rem] truncate text-admin-ink" title={r.customerName}>{r.customerName}</p>
                          <p className="text-xs text-admin-muted">{r.city}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-admin-ink">{formatPKR(r.amount)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadgeClass(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <Link
                            href={`/vendor/dashboard/orders/${r.id}`}
                            aria-label={`Open order ${r.orderNumber}`}
                            title="Open order"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-admin-ink hover:bg-admin-bg"
                          >
                            <MoreVertical className="h-4 w-4" aria-hidden />
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
          <section className={`${card} min-w-0 p-5`} aria-labelledby="top-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-admin-lime/25 text-admin-primary">
                  <BarChart3 className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 id="top-heading" className="text-lg font-bold text-admin-ink">Top Products</h2>
                  <p className="text-sm text-admin-muted">Best performing products</p>
                </div>
              </div>
              <Link href="/vendor/dashboard/products" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-admin-primary hover:underline">
                View All <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            {topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-admin-muted">No product sales yet.</p>
            ) : (
              <ul className="divide-y divide-admin-border">
                {topProducts.map((p) => (
                  <li key={p.id}>
                    <Link href={`/vendor/dashboard/products/${p.id}/edit`} className="flex items-center gap-3 py-3 hover:bg-admin-bg/60">
                      <span className="relative inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-admin-border bg-admin-bg">
                        {p.image ? (
                          <Image src={p.image} alt={p.name} fill sizes="64px" className="object-cover" unoptimized={shouldUnoptimizeImageSrc(p.image)} />
                        ) : (
                          <Package className="h-6 w-6 text-admin-muted" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-admin-ink" title={p.name}>{p.name}</span>
                        <span className="block text-sm text-admin-muted">{formatPKR(p.price)}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xl font-bold tabular-nums text-admin-ink">{p.sold}</span>
                        <span className="block text-xs text-admin-muted">sold</span>
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
