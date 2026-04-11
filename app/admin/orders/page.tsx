"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { formatPKR } from "@/lib/format";

function orderRowId(row: Record<string, unknown>) {
  const raw = row.id ?? row._id;
  if (raw == null || raw === "") return "";
  return String(raw);
}

const TABS = [
  "all",
  "pending",
  "confirmed",
  "processing",
  "packing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export default function AdminOrdersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<string>("all");
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const ac = new AbortController();
    const q = tab === "all" ? "" : `?status=${tab}`;
    (async () => {
      try {
        const r = await fetch(`/api/orders${q}`, {
          signal: ac.signal,
          credentials: "same-origin",
        });
        let data: { orders?: unknown[]; error?: string } = {};
        try {
          data = (await r.json()) as typeof data;
        } catch {
          toast.error("Invalid response from orders API");
          setOrders([]);
          return;
        }
        if (!r.ok) {
          toast.error(data.error || `Orders failed (${r.status})`);
          setOrders([]);
          return;
        }
        const list = (data.orders || []) as Record<string, unknown>[];
        setOrders(list);

        const unreadIds = list
          .filter((o) => o.isRead === false)
          .map((o) => orderRowId(o as Record<string, unknown>))
          .filter(Boolean);
        if (unreadIds.length > 0) {
          void Promise.all(
            unreadIds.map((id) =>
              fetch(`/api/orders/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ isRead: true }),
              })
            )
          ).catch(() => {});
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        toast.error("Failed to load orders");
        setOrders([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [tab]);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-darkText mb-6">Orders</h1>
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${
              tab === t
                ? "bg-primaryBlue text-white"
                : "bg-white border border-borderGray text-darkText"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-darkText/50">Loading…</p>
      ) : (
        <div className="rounded-card border border-borderGray bg-white overflow-x-auto shadow-card">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead className="bg-lightGray border-b border-borderGray">
              <tr>
                <th className="p-3">Order#</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((row) => {
                const oid = orderRowId(row);
                return (
                <tr
                  key={oid || String(row.orderNumber)}
                  className="cursor-pointer border-b border-borderGray hover:bg-lightGray/50"
                  onClick={() => {
                    if (oid) router.push(`/admin/orders/${oid}`);
                  }}
                >
                  <td className="p-3">
                    {oid ? (
                      <Link
                        href={`/admin/orders/${oid}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primaryBlue font-semibold hover:underline"
                      >
                        {String(row.orderNumber)}
                      </Link>
                    ) : (
                      <span className="font-semibold text-primaryBlue">
                        {String(row.orderNumber)}
                      </span>
                    )}
                  </td>
                  <td className="p-3">{String(row.customerName)}</td>
                  <td className="p-3">{formatPKR(Number(row.totalAmount))}</td>
                  <td className="p-3 capitalize">
                    {String(row.paymentMethod)} / {String(row.paymentStatus)}
                  </td>
                  <td className="p-3">{String(row.orderStatus)}</td>
                  <td className="p-3 text-darkText/60">
                    {row.createdAt
                      ? new Date(String(row.createdAt)).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
