"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Search, ShieldAlert } from "lucide-react";
import { formatPKR } from "@/lib/format";

type Row = { id: string; name: string; email: string; phone: string; provider: string | null; isActive: boolean; adminNote: string | null; createdAt: string; totalSpent: number; counts: { orders: number; wants: number; returnRequests: number; disputes: number; savedProducts: number; storeFollows: number } };

export default function AdminCustomersPage() {
  const [rows, setRows] = useState<Row[]>([]); const [q, setQ] = useState(""); const [status, setStatus] = useState("all"); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const params = new URLSearchParams(); if (q.trim()) params.set("q", q.trim()); if (status !== "all") params.set("status", status); const response = await fetch(`/api/admin/customers?${params}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load customers"); setRows(data.customers ?? []); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not load customers"); }
    finally { setLoading(false); }
  }, [q, status]);
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);

  async function toggle(row: Row) {
    const note = window.prompt(row.isActive ? "Reason for suspending this customer" : "Reason for reactivating this customer"); if (!note) return;
    const response = await fetch(`/api/admin/customers/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !row.isActive, adminNote: note }) });
    const data = await response.json(); if (!response.ok) return toast.error(data.error || "Could not update customer"); toast.success(row.isActive ? "Customer suspended and sessions revoked" : "Customer reactivated"); await load();
  }

  return <main className="p-6 md:p-8"><div><p className="text-sm font-black uppercase tracking-wider text-brand-link">Access & activity</p><h1 className="text-2xl font-black text-darkText">Customers</h1><p className="mt-2 text-sm text-darkText/60">Review real account activity. Suspension is reversible and immediately invalidates existing customer sessions.</p></div><div className="mt-6 flex flex-col gap-3 rounded-2xl border border-borderGray bg-white p-4 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-darkText/35" /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, email or phone" className="w-full rounded-xl border border-borderGray py-2.5 pl-10 pr-3 text-sm" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-borderGray px-3 py-2.5 text-sm font-semibold"><option value="all">All accounts</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>{loading ? <p className="py-16 text-center text-darkText/50">Loading customers…</p> : <section className="mt-5 grid gap-4 xl:grid-cols-2">{rows.map((row) => <article key={row.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-brand-dark">{row.name}</h2><p className="mt-1 text-sm text-darkText/55">{row.email}{row.phone ? ` · ${row.phone}` : ""}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{row.isActive ? "Active" : "Suspended"}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><Stat label="Orders" value={row.counts.orders} /><Stat label="Spent" value={formatPKR(row.totalSpent)} /><Stat label="Cases" value={row.counts.returnRequests + row.counts.disputes} /></div><p className="mt-3 text-xs text-darkText/45">{row.counts.savedProducts} saved · {row.counts.storeFollows} followed stores · {row.counts.wants} Wants</p>{row.adminNote ? <p className="mt-3 rounded-xl bg-lightGray p-3 text-xs text-darkText/65"><strong>Admin note:</strong> {row.adminNote}</p> : null}<button onClick={() => void toggle(row)} className={`mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${row.isActive ? "border border-red-200 text-red-700" : "bg-brand-primary text-brand-dark"}`}><ShieldAlert className="h-4 w-4" />{row.isActive ? "Suspend account" : "Reactivate account"}</button></article>)}</section>}</main>;
}

function Stat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-lightGray p-3"><p className="text-sm font-black text-brand-dark">{value}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-darkText/40">{label}</p></div>; }
