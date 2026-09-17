"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Ticket = { id: string; ticketNumber: string; subject: string; category: string; status: string; relatedResourceType: string | null; lastActivityAt: string };

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" }, { value: "open", label: "Open" }, { value: "waiting", label: "Waiting for Me" }, { value: "resolved", label: "Resolved" },
];

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

export function TicketList({ apiBase, ticketsHref, newTicketHref }: { apiBase: string; ticketsHref: string; newTicketHref: string }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/tickets?filter=${filter}&page=${page}`, { credentials: "same-origin" });
      const d = await r.json();
      if (r.ok) { setTickets(d.tickets || []); setTotal(d.total || 0); setPageSize(d.pageSize || 20); }
    } finally { setLoading(false); }
  }, [apiBase, filter, page]);
  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-darkText">My Tickets</h1>
        <Link href={newTicketHref} className="rounded-xl bg-brand-primary px-4 py-2.5 font-bold text-brand-dark">Create Support Ticket</Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => { setFilter(f.value); setPage(1); }} className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${filter === f.value ? "bg-brand-primary text-brand-dark" : "border border-borderGray text-darkText"}`}>{f.label}</button>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-brand-background text-xs font-bold uppercase text-darkText/60">
            <tr><th className="p-3">Ticket #</th><th className="p-3">Subject</th><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3">Last Updated</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {loading ? <tr><td className="p-4" colSpan={6}>Loading…</td></tr> : tickets.length === 0 ? <tr><td className="p-4 text-darkText/60" colSpan={6}>No tickets in this filter.</td></tr> : tickets.map(t => (
              <tr key={t.id} className="border-t">
                <td className="p-3 font-bold">{t.ticketNumber}</td>
                <td className="p-3">{t.subject}</td>
                <td className="p-3">{t.category.replace(/_/g, " ")}</td>
                <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(t.status)}`}>{t.status.replace(/_/g, " ")}</span></td>
                <td className="p-3 whitespace-nowrap">{new Date(t.lastActivityAt).toLocaleString()}</td>
                <td className="p-3"><Link href={`${ticketsHref}/${t.id}`} className="font-bold text-brand-link underline">Open Ticket</Link></td>
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
