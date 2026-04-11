"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { formatPKR } from "@/lib/format";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [unread, setUnread] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
        let p: { products?: unknown[]; error?: string };

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

        setOrders((o.orders || []) as Record<string, unknown>[]);
        setUnread(o.unread ?? 0);
        setProductCount((p.products || []).length);
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

    void load();
    return () => ac.abort();
  }, [router]);

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((x) =>
    ["pending", "confirmed", "processing"].includes(String(x.orderStatus))
  ).length;
  const revenue = orders
    .filter((x) => x.paymentStatus === "received" || x.paymentMethod === "cod")
    .reduce((s, x) => s + Number(x.totalAmount || 0), 0);

  const recent = orders.slice(0, 10);

  function orderRowId(row: Record<string, unknown>) {
    const raw = row.id ?? row._id;
    if (raw == null || raw === "") return "";
    return String(raw);
  }

  if (loading) {
    return (
      <div className="p-8 animate-pulse text-darkText/50">Loading dashboard…</div>
    );
  }

  return (
    <div className="max-w-6xl p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="border-l-4 border-primaryYellow pl-3 text-2xl font-bold text-darkText">
          Dashboard
        </h1>
        {unread > 0 ? (
          <Link
            href="/admin/orders"
            className="rounded-full bg-primaryYellow px-4 py-1.5 text-sm font-bold text-white hover:brightness-110"
          >
            🔔 {unread} New Orders
          </Link>
        ) : null}
        <Link
          href="/admin/products/add"
          className="rounded-xl bg-primaryBlue px-5 py-2.5 font-semibold text-white hover:bg-darkBlue"
        >
          + Quick Add Product
        </Link>
      </div>

      <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total Orders", String(totalOrders)],
          ["Active / Pending pipeline", String(pendingOrders)],
          ["Revenue (PKR)", formatPKR(revenue)],
          ["Products", String(productCount)],
        ].map(([label, val], idx) => (
          <div
            key={label}
            className={`rounded-card border border-borderGray p-4 shadow-card ${
              idx === 0
                ? "bg-amber-50"
                : idx === 1
                  ? "bg-sky-50"
                  : idx === 2
                    ? "bg-amber-50"
                    : "bg-sky-50"
            }`}
          >
            <p
              className={`text-xs uppercase ${
                idx === 0
                  ? "text-amber-600"
                  : idx === 1
                    ? "text-sky-400"
                    : idx === 2
                      ? "text-amber-600"
                      : "text-sky-500"
              }`}
            >
              {label}
            </p>
            <p
              className={`mt-1 text-3xl font-extrabold ${
                idx === 0
                  ? "text-amber-700"
                  : idx === 1
                    ? "text-sky-500"
                    : idx === 2
                      ? "text-amber-700"
                      : "text-sky-500"
              }`}
            >
              {val}
            </p>
            <p className="mt-1 text-xs text-darkText/60">Live dashboard snapshot</p>
          </div>
        ))}
      </div>

      <h2 className="mb-4 text-lg font-bold text-darkText">Recent orders</h2>
      <div className="rounded-card border border-borderGray bg-white overflow-x-auto shadow-card">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-primaryYellow bg-primaryYellow text-white">
            <tr>
              <th className="p-3">Order#</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((row) => {
              const oid = orderRowId(row);
              return (
              <tr
                key={oid || String(row.orderNumber)}
                className="cursor-pointer border-b border-borderGray odd:bg-white even:bg-sky-50 hover:bg-amber-50"
                onClick={() => {
                  if (oid) router.push(`/admin/orders/${oid}`);
                }}
              >
                <td className="p-3">
                  {oid ? (
                    <Link
                      href={`/admin/orders/${oid}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-sky-500 hover:underline"
                    >
                      {String(row.orderNumber)}
                    </Link>
                  ) : (
                    <span className="font-semibold text-sky-500">
                      {String(row.orderNumber)}
                    </span>
                  )}
                  {!row.isRead ? (
                    <span className="ml-2 text-primaryYellow text-xs">●</span>
                  ) : null}
                </td>
                <td className="p-3">{String(row.customerName)}</td>
                <td className="p-3">{formatPKR(Number(row.totalAmount))}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      String(row.orderStatus).toLowerCase() === "delivered"
                        ? "bg-green-100 text-green-700"
                        : String(row.orderStatus).toLowerCase() === "pending"
                          ? "bg-amber-100 text-amber-800"
                          : String(row.orderStatus).toLowerCase() === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    {String(row.orderStatus)}
                  </span>
                </td>
                <td className="p-3 text-darkText/60">
                  {row.createdAt
                    ? new Date(String(row.createdAt)).toLocaleDateString("en-PK")
                    : "—"}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
