"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { OrderCard } from "@/components/orders/OrderCard";
import { OrderTable } from "@/components/orders/OrderTable";
import type { ShopOrderListRow } from "@/components/orders/shop-order-types";

const STATUSES = [
  "all",
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

type VendorOpt = { id: string; shopName: string };

function toCsv(rows: ShopOrderListRow[]): string {
  const headers = [
    "shopOrderNumber",
    "parentOrderNumber",
    "vendorShopName",
    "customerName",
    "city",
    "totalAmount",
    "commissionAmount",
    "netAmount",
    "status",
    "paymentMethod",
    "paymentStatus",
    "placedAt",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const vendorName = r.vendor?.shopName ?? "";
    const esc = (x: string) =>
      `"${String(x).replace(/"/g, '""')}"`;
    lines.push(
      [
        esc(r.shopOrderNumber),
        esc(r.parentOrderNumber),
        esc(vendorName),
        esc(r.customerName),
        esc(r.city),
        r.totalAmount,
        r.commissionAmount,
        r.netAmount,
        esc(r.orderStatus),
        esc(r.paymentMethod),
        esc(r.paymentStatus),
        esc(r.placedAt),
      ].join(",")
    );
  }
  return lines.join("\n");
}

/** Admin overview of all seller bundles + CSV export. */
export default function AdminVendorOrdersPage() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [vendorId, setVendorId] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  const [rows, setRows] = useState<ShopOrderListRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/admin/vendors?status=approved", {
          credentials: "same-origin",
        });
        const j = (await r.json()) as { vendors?: VendorOpt[] };
        if (r.ok && Array.isArray(j.vendors)) {
          setVendors(
            j.vendors.map((v) => ({ id: v.id, shopName: v.shopName }))
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (status !== "all") p.set("status", status);
    if (vendorId) p.set("vendorId", vendorId);
    if (debouncedQ) p.set("q", debouncedQ);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [status, vendorId, debouncedQ, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/orders/admin/all${queryString}`, {
        credentials: "same-origin",
      });
      const data = (await r.json()) as {
        orders?: ShopOrderListRow[];
        error?: string;
      };
      if (!r.ok) {
        toast.error(data.error || "Could not load");
        setRows([]);
        return;
      }
      setRows(data.orders ?? []);
    } catch {
      toast.error("Network error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    if (rows.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const blob = new Blob([toCsv(rows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendor-shop-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download started");
  }

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-darkText">Seller orders</h1>
          <p className="mt-1 text-sm text-darkText/70">
            All bundled vendor checkouts — filter, inspect, export CSV.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-xl border border-borderGray bg-white px-4 py-2 text-sm font-bold text-darkText hover:bg-lightGray/40"
        >
          Export CSV
        </button>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="rounded-lg border border-borderGray px-3 py-2 text-sm"
        >
          <option value="">All vendors</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.shopName}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-borderGray px-3 py-2 text-sm"
          aria-label="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border border-borderGray px-3 py-2 text-sm"
          aria-label="To date"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Shop # or customer…"
          className="rounded-lg border border-borderGray px-3 py-2 text-sm"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-2 text-xs font-bold capitalize sm:text-sm ${
              status === s
                ? "bg-primaryBlue text-white"
                : "border border-borderGray bg-white text-darkText hover:bg-lightGray/40"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-darkText/50">Loading…</p>
      ) : (
        <>
          <OrderTable
            rows={rows}
            showVendorColumn
            getDetailHref={(id) => `/admin/vendor-orders/${id}`}
          />
          <OrderCard
            rows={rows}
            showVendor
            getDetailHref={(id) => `/admin/vendor-orders/${id}`}
          />
        </>
      )}

      <p className="mt-8 text-sm text-darkText/50">
        <Link href="/admin/orders" className="text-primaryBlue font-semibold">
          ← Storefront orders (checkout)
        </Link>
      </p>
    </div>
  );
}
