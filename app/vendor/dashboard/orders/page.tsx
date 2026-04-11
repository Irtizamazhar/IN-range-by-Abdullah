"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    const s = searchParams?.get("status")?.toLowerCase();
    if (s && TABS.includes(s as (typeof TABS)[number])) {
      setTab(s as (typeof TABS)[number]);
    }
  }, [searchParams]);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [rows, setRows] = useState<ShopOrderListRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (tab !== "all") p.set("status", tab);
    if (debouncedQ) p.set("q", debouncedQ);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [tab, debouncedQ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/orders/vendor${queryString}`, {
        credentials: "include",
      });
      const data = (await r.json()) as {
        orders?: ShopOrderListRow[];
        counts?: Record<string, number>;
        error?: string;
      };
      if (!r.ok) {
        toast.error(data.error || "Could not load orders");
        setRows([]);
        setCounts({});
        return;
      }
      setRows(data.orders ?? []);
      setCounts(data.counts ?? {});
    } catch {
      toast.error("Network error");
      setRows([]);
      setCounts({});
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6">
        <h1 className="border-l-4 border-primaryYellow pl-3 text-2xl font-bold text-darkText">
          Orders
        </h1>
        <p className="mt-1 text-sm text-darkText/70">
          Bundled checkout per seller — confirm, pack, ship, and mark delivered.
          Commission is calculated per item at checkout.
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
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold capitalize sm:text-sm ${
                tab === t
                  ? "bg-primaryBlue text-white"
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
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-center text-darkText/50">Loading…</p>
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
        <div className="mx-auto max-w-6xl p-8 text-center text-darkText/50">
          Loading…
        </div>
      }
    >
      <VendorOrdersPageInner />
    </Suspense>
  );
}
