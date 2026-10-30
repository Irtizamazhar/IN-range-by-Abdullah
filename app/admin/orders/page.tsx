"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/ui/LoadingLink";
import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";
import toast from "react-hot-toast";
import { formatPKR } from "@/lib/format";
import { Trash2, X } from "lucide-react";

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
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const requestRef = useRef<AbortController | null>(null);
  const load = useCallback(async (nextTab: string) => {
    setTab(nextTab);
    setSelected(new Set());
    setLoading(true);
    requestRef.current?.abort();
    const ac = new AbortController();
    requestRef.current = ac;
    const q = nextTab === "all" ? "" : `?status=${nextTab}`;
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
        if (ac.signal.aborted) return;
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
  }, []);

  const selectableIds = orders.map((row) => orderRowId(row)).filter(Boolean);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  function stopSelecting() { setSelecting(false); setSelected(new Set()); setConfirming(false); }
  function toggle(id: string) {
    setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  async function deleteSelected() {
    const r = await fetch("/api/admin/orders", { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ ids: Array.from(selected) }) });
    const data = (await r.json().catch(() => ({}))) as { deleted?: number; skipped?: number; error?: string };
    setConfirming(false);
    if (!r.ok) { toast.error(data.error || "Could not delete orders"); return; }
    toast.success(`${data.deleted || 0} ${data.deleted === 1 ? "order" : "orders"} deleted permanently${data.skipped ? ` · ${data.skipped} kept because they have refunds or vendor payouts` : ""}`);
    stopSelecting();
    await load(tab);
  }

  useEffect(() => {
    void load("all");
    return () => requestRef.current?.abort();
  }, [load]);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-darkText mb-6">Orders</h1>
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6">
        {TABS.map((t) => (
          <LoadingButton loadingLabel="Loading..."
            key={t}
            type="button"
            onClick={() => load(t)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${
              tab === t
                ? "bg-brand-primary text-brand-dark"
                : "bg-white border border-borderGray text-darkText"
            }`}
          >
            {t}
          </LoadingButton>
        ))}
        <button
          type="button"
          onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
          aria-pressed={selecting}
          aria-label={selecting ? "Cancel delete" : "Delete orders"}
          title={selecting ? "Cancel delete" : "Delete orders"}
          className={`ml-auto shrink-0 rounded-full border p-2 ${selecting ? "border-red-600 bg-red-600 text-white" : "border-red-200 bg-white text-red-700 hover:bg-red-50"}`}
        >
          {selecting ? <X className="h-4 w-4" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {selecting && !loading && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-darkText">
            <input type="checkbox" checked={allSelected} disabled={!selectableIds.length} onChange={() => setSelected(allSelected ? new Set() : new Set(selectableIds))} className="h-4 w-4 accent-red-600" />
            Select all
          </label>
          <span className="text-darkText/60">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={stopSelecting} className="rounded-full border border-borderGray bg-white px-4 py-1.5 font-semibold text-darkText">Cancel</button>
            <button type="button" disabled={!selected.size} onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" />Delete selected</button>
          </div>
        </div>
      )}
      {loading ? (
        <PageSkeleton rows={3} />
      ) : (
        <div className="rounded-card border border-borderGray bg-white overflow-x-auto shadow-card">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead className="bg-lightGray border-b border-borderGray">
              <tr>
                {selecting && <th className="w-10 p-3"><span className="sr-only">Select</span></th>}
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
                    if (!oid) return;
                    if (selecting) toggle(oid);
                    else router.push(`/admin/orders/${oid}`);
                  }}
                >
                  {selecting && (
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(oid)} disabled={!oid} onChange={() => toggle(oid)} aria-label={`Select order ${String(row.orderNumber)}`} className="h-4 w-4 accent-red-600" />
                    </td>
                  )}
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
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirming(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="order-delete-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-card border border-borderGray bg-white p-6 shadow-xl">
            <h2 id="order-delete-title" className="flex items-center gap-2 text-lg font-bold text-red-700"><Trash2 className="h-5 w-5" aria-hidden="true" />Delete {selected.size} {selected.size === 1 ? "order" : "orders"}?</h2>
            <p className="mt-2 text-sm text-darkText/70">Are you sure you want to permanently delete the selected orders? Their items, tracking history, returns and vendor earnings are removed and reserved stock is returned. This action cannot be undone.</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-borderGray px-4 py-2 text-sm font-semibold text-darkText">Cancel</button>
              <LoadingButton type="button" loadingLabel="Deleting…" onClick={deleteSelected} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"><Trash2 className="h-4 w-4" aria-hidden="true" />Delete Permanently</LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
