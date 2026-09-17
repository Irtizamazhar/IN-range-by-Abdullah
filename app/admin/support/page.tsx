"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

type Ticket = {
  id: string; ticketNumber: string; actorType: string; category: string; subject: string; status: string; priority: string;
  relatedResourceType: string | null; relatedResourceId: string | null; createdAt: string; lastActivityAt: string;
  customer: { name: string; email: string } | null; vendor: { shopName: string; email: string } | null;
  assignedTo: { id: string; name: string } | null;
};

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "CUSTOMER_REPLIED", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

function statusBadgeClass(s: string) {
  switch (s) {
    case "OPEN": return "bg-amber-100 text-amber-900";
    case "IN_PROGRESS": return "bg-blue-100 text-blue-800";
    case "WAITING_FOR_CUSTOMER": return "bg-purple-100 text-purple-800";
    case "CUSTOMER_REPLIED": return "bg-emerald-100 text-emerald-800";
    case "RESOLVED": return "bg-neutral-200 text-neutral-800";
    case "CLOSED": return "bg-neutral-300 text-neutral-700";
    default: return "bg-neutral-100 text-neutral-800";
  }
}
function priorityBadgeClass(p: string) {
  switch (p) {
    case "URGENT": return "bg-red-100 text-red-800";
    case "HIGH": return "bg-orange-100 text-orange-800";
    case "LOW": return "bg-neutral-100 text-neutral-700";
    default: return "bg-blue-50 text-blue-700";
  }
}

export default function AdminSupportQueuePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [actorType, setActorType] = useState("");
  const [priority, setPriority] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (status) params.set("status", status);
      if (actorType) params.set("actorType", actorType);
      if (priority) params.set("priority", priority);
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch(`/api/admin/support/tickets?${params.toString()}`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "Could not load queue"); return; }
      setTickets(d.tickets || []); setTotal(d.total || 0); setPageSize(d.pageSize || 20);
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  }, [page, status, actorType, priority, q]);
  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <h1 className="text-2xl font-black text-darkText">Support</h1>
      <p className="mt-1 text-sm text-darkText/70">Customer and vendor support tickets.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search ticket #, subject, or reference…" className="w-64 rounded-lg border border-borderGray px-3 py-2 text-sm" />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-borderGray px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <select value={actorType} onChange={e => { setActorType(e.target.value); setPage(1); }} className="rounded-lg border border-borderGray px-3 py-2 text-sm">
          <option value="">Customer + Vendor</option>
          <option value="CUSTOMER">Customer Tickets</option>
          <option value="VENDOR">Vendor Tickets</option>
        </select>
        <select value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }} className="rounded-lg border border-borderGray px-3 py-2 text-sm">
          <option value="">All priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-brand-background text-xs font-bold uppercase text-darkText/60">
            <tr>
              <th className="p-3">Ticket #</th><th className="p-3">Who</th><th className="p-3">Type</th><th className="p-3">Category</th>
              <th className="p-3">Subject</th><th className="p-3">Related</th><th className="p-3">Priority</th><th className="p-3">Status</th>
              <th className="p-3">Assigned</th><th className="p-3">Last Activity</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td className="p-4" colSpan={11}>Loading…</td></tr> : tickets.length === 0 ? <tr><td className="p-4 text-darkText/60" colSpan={11}>No tickets match these filters.</td></tr> : tickets.map(t => (
              <tr key={t.id} className="border-t">
                <td className="p-3 font-bold">{t.ticketNumber}</td>
                <td className="p-3">{t.actorType === "CUSTOMER" ? (t.customer?.name || "—") : (t.vendor?.shopName || "—")}</td>
                <td className="p-3">{t.actorType}</td>
                <td className="p-3">{t.category.replace(/_/g, " ")}</td>
                <td className="p-3 max-w-[220px] truncate">{t.subject}</td>
                <td className="p-3 text-xs text-darkText/60">{t.relatedResourceType ? t.relatedResourceType.replace(/_/g, " ") : "—"}</td>
                <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${priorityBadgeClass(t.priority)}`}>{t.priority}</span></td>
                <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(t.status)}`}>{t.status.replace(/_/g, " ")}</span></td>
                <td className="p-3 text-xs">{t.assignedTo?.name || "Unassigned"}</td>
                <td className="p-3 whitespace-nowrap text-xs">{new Date(t.lastActivityAt).toLocaleString()}</td>
                <td className="p-3"><Link href={`/admin/support/${t.id}`} className="font-bold text-brand-link underline">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border px-3 py-1.5 text-sm font-bold disabled:opacity-40">Previous</button>
          <span className="text-sm text-darkText/70">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg border px-3 py-1.5 text-sm font-bold disabled:opacity-40">Next</button>
        </div>
      ) : null}
    </div>
  );
}
