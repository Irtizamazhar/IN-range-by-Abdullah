"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/LoadingLink";
import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";
import toast from "react-hot-toast";
import { formatPKR } from "@/lib/format";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react";
import { SalesOverviewChart, type SalesPoint } from "@/components/admin/dashboard/SalesOverviewChart";
import { OrderStatusDonut, type StatusSlice } from "@/components/admin/dashboard/OrderStatusDonut";

type Row = Record<string, unknown>;
type RangeKey = "7d" | "30d" | "90d" | "12m" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "12m", label: "Last 12 months" },
  { key: "all", label: "All time" },
];

// Validated categorical order (adjacent pairs pass CVD + normal-vision checks).
const STATUS_GROUPS: { key: string; label: string; color: string; statuses: string[] }[] = [
  { key: "pending", label: "Pending", color: "#D99A12", statuses: ["pending"] },
  { key: "processing", label: "Processing", color: "#2F7DD1", statuses: ["confirmed", "processing", "packed"] },
  { key: "shipped", label: "Shipped", color: "#C2569B", statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", color: "#0B8457", statuses: ["delivered"] },
  { key: "cancelled", label: "Cancelled", color: "#7A5AC8", statuses: ["cancelled"] },
];

const DAY = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function rangeStart(range: RangeKey, now: Date): Date | null {
  const today = startOfDay(now);
  if (range === "7d") return new Date(today.getTime() - 6 * DAY);
  if (range === "30d") return new Date(today.getTime() - 29 * DAY);
  if (range === "90d") return new Date(today.getTime() - 89 * DAY);
  if (range === "12m") return new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return null;
}

function orderDate(row: Row): Date | null {
  if (!row.createdAt) return null;
  const d = new Date(String(row.createdAt));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Same revenue rule the dashboard has always used. */
function countsAsRevenue(row: Row) {
  return row.paymentStatus === "received" || row.paymentMethod === "cod";
}

function buildSeries(rows: Row[], range: RangeKey, now: Date): SalesPoint[] {
  const dayFmt = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short" });
  const dayFull = new Intl.DateTimeFormat("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const monthFmt = new Intl.DateTimeFormat("en-PK", { month: "short" });
  const monthFull = new Intl.DateTimeFormat("en-PK", { month: "long", year: "numeric" });

  type Bucket = SalesPoint & { start: number; end: number };
  const buckets: Bucket[] = [];
  const today = startOfDay(now);

  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const s = new Date(today.getTime() - i * DAY);
      buckets.push({ start: s.getTime(), end: s.getTime() + DAY, label: dayFmt.format(s), fullLabel: dayFull.format(s), value: 0, orders: 0 });
    }
  } else if (range === "90d") {
    const first = new Date(today.getTime() - 89 * DAY);
    for (let s = first.getTime(); s <= today.getTime(); s += 7 * DAY) {
      const e = Math.min(s + 7 * DAY, today.getTime() + DAY);
      buckets.push({
        start: s,
        end: e,
        label: dayFmt.format(new Date(s)),
        fullLabel: `${dayFmt.format(new Date(s))} – ${dayFmt.format(new Date(e - DAY))}`,
        value: 0,
        orders: 0,
      });
    }
  } else {
    let first = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    if (range === "all") {
      const dates = rows.map(orderDate).filter((d): d is Date => d != null);
      const earliest = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : now;
      const fromData = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
      const minSpan = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      first = fromData < minSpan ? fromData : minSpan;
    }
    const multiYear = first.getFullYear() !== now.getFullYear();
    for (let m = new Date(first); m <= now; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      buckets.push({
        start: m.getTime(),
        end: next.getTime(),
        label: multiYear ? `${monthFmt.format(m)} ’${String(m.getFullYear()).slice(2)}` : monthFmt.format(m),
        fullLabel: monthFull.format(m),
        value: 0,
        orders: 0,
      });
    }
  }

  for (const row of rows) {
    const d = orderDate(row);
    if (!d) continue;
    const t = d.getTime();
    const b = buckets.find((x) => t >= x.start && t < x.end);
    if (!b) continue;
    b.orders += 1;
    if (countsAsRevenue(row)) b.value += Number(row.totalAmount || 0);
  }
  return buckets.map(({ label, fullLabel, value, orders }) => ({ label, fullLabel, value, orders }));
}

function statusPill(status: string) {
  const s = status.toLowerCase();
  if (s === "delivered") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (s === "pending") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (s === "cancelled") return "bg-red-50 text-red-700 ring-red-200";
  if (s === "shipped") return "bg-sky-50 text-sky-800 ring-sky-200";
  return "bg-[#EAF4EC] text-admin-primary ring-[#CFE3D5]";
}

function paymentPill(status: string) {
  const s = status.toLowerCase();
  if (s === "received") return "text-emerald-700";
  if (s === "failed" || s === "rejected") return "text-red-700";
  if (s.includes("refund")) return "text-violet-700";
  return "text-amber-700";
}

function humanize(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "—";
  if (s.toLowerCase() === "cod") return "COD";
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Row[]>([]);
  const [unread, setUnread] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [customerCount, setCustomerCount] = useState<{ value: number; capped: boolean } | null | "forbidden" | "error">(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const ac = new AbortController();

    async function load() {
      try {
        const [or, pr] = await Promise.all([
          fetch("/api/orders", {
            signal: ac.signal,
            credentials: "same-origin",
          }),
          fetch("/api/products?admin=1&limit=500", {
            signal: ac.signal,
            credentials: "same-origin",
          }),
        ]);

        let o: { orders?: unknown[]; unread?: number; error?: string };
        let p: { products?: unknown[]; total?: number; error?: string };

        const orText = await or.text();
        try {
          o = JSON.parse(orText) as typeof o;
        } catch {
          const snippet = orText.slice(0, 120);
          throw new Error(
            snippet.trim() && !snippet.trimStart().startsWith("{")
              ? `Orders API returned non-JSON (${or.status}). Is the server running?`
              : "Invalid response from orders API"
          );
        }
        const prText = await pr.text();
        try {
          p = JSON.parse(prText) as typeof p;
        } catch {
          throw new Error("Invalid response from products API");
        }

        if (ac.signal.aborted) return;

        if (!or.ok) {
          if (or.status === 401) {
            toast.error("Please sign in again");
            router.push("/admin/login");
            return;
          }
          toast.error(o.error || `Orders failed (${or.status})`);
          return;
        }
        if (!pr.ok) {
          if (pr.status === 401) {
            toast.error("Please sign in again");
            router.push("/admin/login");
            return;
          }
          toast.error(p.error || `Products failed (${pr.status})`);
          return;
        }

        setOrders((o.orders || []) as Row[]);
        setUnread(o.unread ?? 0);
        const listed = (p.products || []).length;
        setProductCount(Number.isFinite(Number(p.total)) ? Number(p.total) : listed);
      } catch (e) {
        if (ac.signal.aborted) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error(e);
        toast.error(
          e instanceof Error ? e.message : "Data load failed — check console"
        );
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    // Customer total is secondary: a failure or missing permission only affects its card.
    fetch("/api/admin/customers", { signal: ac.signal, credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 403) return setCustomerCount("forbidden");
        if (!r.ok) return setCustomerCount("error");
        const data = (await r.json()) as { customers?: unknown[] };
        const n = (data.customers || []).length;
        // The customers API returns at most 250 rows.
        setCustomerCount({ value: n, capped: n >= 250 });
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setCustomerCount("error");
      });

    void load();
    return () => ac.abort();
  }, [router]);

  const now = useMemo(() => new Date(), []);
  const inRange = useMemo(() => {
    const start = rangeStart(range, now);
    if (!start) return orders;
    return orders.filter((row) => {
      const d = orderDate(row);
      return d != null && d >= start;
    });
  }, [orders, range, now]);

  const totalOrders = inRange.length;
  const pendingOrders = inRange.filter((x) =>
    ["pending", "confirmed", "processing"].includes(String(x.orderStatus))
  ).length;
  const revenue = inRange
    .filter(countsAsRevenue)
    .reduce((s, x) => s + Number(x.totalAmount || 0), 0);

  const series = useMemo(() => buildSeries(inRange, range, now), [inRange, range, now]);
  const slices: StatusSlice[] = useMemo(
    () =>
      STATUS_GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        color: g.color,
        count: inRange.filter((row) => g.statuses.includes(String(row.orderStatus).toLowerCase())).length,
      })),
    [inRange]
  );

  const q = query.trim().toLowerCase();
  const matches = q
    ? inRange.filter((row) => {
        const products = Array.isArray(row.products) ? (row.products as Row[]) : [];
        return [row.orderNumber, row.parentOrderNumber, row.customerName, row.customerEmail, row.customerPhone, ...products.map((p) => p.name)]
          .some((v) => String(v ?? "").toLowerCase().includes(q));
      })
    : inRange;
  const recent = matches.slice(0, 10);
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? "";

  function orderRowId(row: Record<string, unknown>) {
    const raw = row.id ?? row._id;
    if (raw == null || raw === "") return "";
    return String(raw);
  }

  if (loading) {
    return (
      <PageSkeleton rows={3} />
    );
  }

  const customerValue =
    customerCount === "forbidden" || customerCount === "error"
      ? "—"
      : customerCount == null
        ? "…"
        : `${customerCount.value.toLocaleString("en-PK")}${customerCount.capped ? "+" : ""}`;

  const cards = [
    {
      label: "Total Sales",
      value: formatPKR(revenue),
      hint: `${rangeLabel} · paid & COD orders`,
      icon: Wallet,
    },
    {
      label: "Total Orders",
      value: totalOrders.toLocaleString("en-PK"),
      hint: `${pendingOrders} in active pipeline`,
      icon: ShoppingBag,
    },
    {
      label: "Total Customers",
      value: customerValue,
      hint:
        customerCount === "forbidden"
          ? "No permission to view customers"
          : customerCount === "error"
            ? "Could not load customers"
            : "Registered accounts · all time",
      icon: Users,
    },
    {
      label: "Total Products",
      value: productCount.toLocaleString("en-PK"),
      hint: "Catalog · all time",
      icon: Package,
    },
  ];

  const card = "rounded-2xl border border-admin-border bg-white shadow-[0_1px_2px_rgba(0,61,43,0.04),0_8px_24px_rgba(0,61,43,0.05)]";

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-admin-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-admin-muted">Marketplace performance from live orders and catalog data.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unread > 0 ? (
            <Link
              href="/admin/orders"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-admin-border bg-white px-4 text-sm font-semibold text-admin-primary hover:bg-admin-bg"
            >
              <Bell className="h-4 w-4" aria-hidden />
              {unread} New Orders
            </Link>
          ) : null}
          <Link
            href="/admin/products/add"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-admin-primary px-4 text-sm font-semibold text-white hover:bg-admin-dark"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Quick Add Product
          </Link>
        </div>
      </div>

      <div className={`${card} mb-6 flex flex-col gap-3 p-3 sm:flex-row sm:items-center`}>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search orders</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recent orders by #, customer or product"
            className="h-10 w-full rounded-xl border border-admin-border bg-admin-bg pl-9 pr-3 text-sm text-admin-ink placeholder:text-admin-muted focus:border-admin-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-admin-primary/15"
          />
        </label>
        <label className="relative sm:w-56">
          <span className="sr-only">Date range</span>
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" aria-hidden />
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            className="h-10 w-full appearance-none rounded-xl border border-admin-border bg-white pl-9 pr-8 text-sm font-medium text-admin-ink focus:border-admin-primary focus:outline-none focus:ring-2 focus:ring-admin-primary/15"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
          </svg>
        </label>
      </div>

      <section aria-label="Summary" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className={`${card} flex min-w-0 items-start gap-4 p-5`}>
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EC] text-admin-primary">
              <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-admin-muted">{label}</p>
              <p className="mt-1 truncate text-2xl font-bold tracking-tight text-admin-ink tabular-nums" title={value}>
                {value}
              </p>
              <p className="mt-1 truncate text-xs text-admin-muted" title={hint}>{hint}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className={`${card} min-w-0 p-5`}>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-admin-ink">Sales Overview</h2>
            <p className="text-xs text-admin-muted">{rangeLabel} · PKR</p>
          </div>
          <SalesOverviewChart points={series} />
        </div>
        <div className={`${card} min-w-0 p-5`}>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-admin-ink">Order Status</h2>
            <p className="text-xs text-admin-muted">{rangeLabel}</p>
          </div>
          <OrderStatusDonut slices={slices} />
        </div>
      </section>

      <section className={`${card} min-w-0 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border px-5 py-4">
          <h2 className="text-base font-bold text-admin-ink">Recent Orders</h2>
          <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-admin-primary hover:underline">
            View all <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-admin-bg text-xs font-semibold uppercase tracking-wide text-admin-muted">
              <tr>
                <th className="px-5 py-3">Order#</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => {
                const oid = orderRowId(row);
                const products = Array.isArray(row.products) ? (row.products as Row[]) : [];
                const firstProduct = products[0] ? String(products[0].name ?? "") : "";
                const status = String(row.orderStatus ?? "");
                return (
                  <tr
                    key={oid || String(row.orderNumber)}
                    className="cursor-pointer border-t border-admin-border transition-colors hover:bg-admin-bg"
                    onClick={() => {
                      if (oid) router.push(`/admin/orders/${oid}`);
                    }}
                  >
                    <td className="whitespace-nowrap px-5 py-3">
                      {oid ? (
                        <Link
                          href={`/admin/orders/${oid}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-admin-primary hover:underline"
                        >
                          {String(row.orderNumber)}
                        </Link>
                      ) : (
                        <span className="font-semibold text-admin-primary">
                          {String(row.orderNumber)}
                        </span>
                      )}
                      {!row.isRead ? (
                        <span className="ml-2 inline-block h-2 w-2 rounded-full bg-admin-lime ring-1 ring-admin-primary/30" title="Unread" aria-label="Unread" />
                      ) : null}
                    </td>
                    <td className="max-w-[12rem] px-4 py-3">
                      <span className="block truncate font-medium text-admin-ink" title={String(row.customerName ?? "")}>
                        {String(row.customerName ?? "—")}
                      </span>
                    </td>
                    <td className="max-w-[16rem] px-4 py-3">
                      <span className="block truncate text-admin-ink" title={products.map((p) => String(p.name ?? "")).join(", ")}>
                        {firstProduct || "—"}
                        {products.length > 1 ? <span className="text-admin-muted"> +{products.length - 1} more</span> : null}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-admin-ink tabular-nums">
                      {formatPKR(Number(row.totalAmount))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="block text-admin-ink">{humanize(row.paymentMethod)}</span>
                      <span className={`block text-xs font-medium ${paymentPill(String(row.paymentStatus ?? ""))}`}>
                        {humanize(row.paymentStatus)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusPill(status)}`}>
                        {status || "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-admin-muted">
                      {row.createdAt
                        ? new Date(String(row.createdAt)).toLocaleDateString("en-PK")
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      {oid ? (
                        <Link
                          href={`/admin/orders/${oid}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex h-8 items-center rounded-lg border border-admin-border px-3 text-xs font-semibold text-admin-primary hover:bg-admin-bg"
                        >
                          View
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!recent.length ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-admin-muted">
                    {q ? "No orders match your search in this date range." : "No orders in this date range."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
