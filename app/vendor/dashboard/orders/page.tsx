"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { OrderCard } from "@/components/orders/OrderCard";
import { OrderTable } from "@/components/orders/OrderTable";
import type { ShopOrderListRow } from "@/components/orders/shop-order-types";

/** Filter tabs matching `VendorShopOrderStatus` + all. */
const TABS = [
  "all",
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

function VendorOrdersPageInner() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");

  const selectedTab = useRef<(typeof TABS)[number]>("all");
  const previousStatus = useRef<string | undefined>();
  const requestVersion = useRef(0);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [rows, setRows] = useState<ShopOrderListRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async (nextTab: (typeof TABS)[number], search: string) => {
    const version = ++requestVersion.current;
    selectedTab.current = nextTab;
    setTab(nextTab);
    const p = new URLSearchParams();
    if (nextTab !== "all") p.set("status", nextTab);
    if (search) p.set("q", search);
    const s = p.toString();
    const queryString = s ? `?${s}` : "";
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/orders/vendor${queryString}`, {
        credentials: "include",
      });
      const data = (await r.json()) as {
        orders?: ShopOrderListRow[];
        counts?: Record<string, number>;
        error?: string;
      };
      if (version !== requestVersion.current) return;
      if (!r.ok) {
        const message = data.error || "Could not load orders";
        toast.error(message);
        setError(message);
        setRows([]);
        setCounts({});
        return;
      }
      setRows(data.orders ?? []);
      setCounts(data.counts ?? {});
    } catch {
      if (version !== requestVersion.current) return;
      toast.error("Network error");
      setError("Could not load orders. Check your connection and retry.");
      setRows([]);
      setCounts({});
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const status = searchParams?.get("status")?.toLowerCase();
    const nextTab = status !== previousStatus.current && status && TABS.includes(status as (typeof TABS)[number]) ? status as (typeof TABS)[number] : selectedTab.current;
    previousStatus.current = status;
    void load(nextTab, debouncedQ);
  }, [load, debouncedQ, searchParams]);

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6">
        <h1 className="border-l-4 border-primaryYellow pl-3 text-2xl font-bold text-darkText">
          Orders
        </h1>
        <p className="mt-1 text-sm text-darkText/70">
          Confirm through packed on your side; admin marks shipped and
          delivered. Commission is calculated per item at checkout.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by shop order # or customer name…"
          className="w-full max-w-md rounded-lg border border-borderGray px-3 py-2 text-sm sm:w-auto"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const n =
            t === "all"
              ? counts.all ?? 0
              : counts[t] ?? 0;
          return (
            <LoadingButton
              key={t}
              type="button"
              onClick={() => load(t, debouncedQ)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold capitalize sm:text-sm ${
                tab === t
                  ? "bg-brand-primary text-brand-dark"
                  : "border border-borderGray bg-white text-darkText hover:bg-lightGray/40"
              }`}
            >
              <span>{t}</span>
              <span
                className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] font-extrabold ${
                  tab === t ? "bg-white/20 text-white" : "bg-primaryBlue/10 text-primaryBlue"
                }`}
              >
                {n}
              </span>
            </LoadingButton>
          );
        })}
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 p-4"><p role="alert" className="text-sm text-red-700">{error}</p><LoadingButton onClick={() => load(tab, debouncedQ)} className="mt-2 font-bold text-brand-link">Retry</LoadingButton></div>}

      {loading ? (
        <PageSkeleton label="Loading…" rows={3} />
      ) : (
        <>
          <OrderTable
            rows={rows}
            getDetailHref={(id) => `/vendor/dashboard/orders/${id}`}
          />
          <OrderCard
            rows={rows}
            getDetailHref={(id) => `/vendor/dashboard/orders/${id}`}
          />
        </>
      )}
    </div>
  );
}

export default function VendorOrdersPage() {
  return (
    <Suspense
      fallback={
        <PageSkeleton label="Loading…" rows={3} />
      }
    >
      <VendorOrdersPageInner />
    </Suspense>
  );
}
