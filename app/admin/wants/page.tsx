"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { formatPKR } from "@/lib/format";

type Want = { id: string; title: string; description: string | null; category: string; city: string; budgetMax: unknown; status: string; moderationReason: string | null; createdAt: string; customer: { name: string; email: string }; _count: { offers: number; interests: number } };

export default function AdminWantsPage() {
  const [wants, setWants] = useState<Want[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { const response = await fetch("/api/admin/wants"); const data = (await response.json()) as { wants?: Want[]; error?: string }; if (!response.ok) throw new Error(data.error || "Could not load Wants"); setWants(data.wants || []); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load Wants"); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function moderate(id: string, status: "OPEN" | "REJECTED" | "CLOSED") {
    let reason = "Approved.";
    if (status === "REJECTED") { const note = window.prompt("Reason shown to the customer:")?.trim(); if (!note) return; reason = note; }
    if (status === "CLOSED") { const note = window.prompt("Reason for closing (shown to the customer):")?.trim(); if (!note) return; reason = note; }
    setBusy(id);
    try {
      const response = await fetch("/api/admin/wants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, reason }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) return toast.error(data.error || "Could not update Want");
      toast.success("Want updated");
      await load();
    } finally { setBusy(null); }
  }
  return <main className="p-6 md:p-8"><h1 className="text-2xl font-black text-darkText">Wants moderation</h1><p className="mt-1 text-sm text-darkText/60">Approve customer demand before vendors can see it. Actions are recorded in audit history.</p>{loading ? <p className="mt-8 text-darkText/50">Loading…</p> : wants.length ? <div className="mt-7 space-y-4">{wants.map((want) => <article key={want.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-3xl"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-link">{want.category}</span><span className="rounded-full border border-borderGray px-2.5 py-1 text-xs font-bold capitalize">{want.status.replaceAll("_", " ").toLowerCase()}</span></div><h2 className="mt-3 text-lg font-black text-darkText">{want.title}</h2><p className="mt-2 text-sm leading-6 text-darkText/60">{want.description}</p><p className="mt-3 text-xs text-darkText/45">{want.customer?.name} · {want.customer?.email} · {want.city} · {want._count.offers} offers · {want._count.interests} interested{want.budgetMax ? ` · Up to ${formatPKR(Number(want.budgetMax))}` : ""}</p>{want.moderationReason && <p className="mt-2 text-xs font-semibold text-red-700">Note: {want.moderationReason}</p>}</div><div className="flex shrink-0 flex-wrap gap-2">{["PENDING_MODERATION", "SUBMITTED", "REJECTED"].includes(want.status) && <button disabled={busy === want.id} onClick={() => void moderate(want.id, "OPEN")} className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-brand-dark">Approve</button>}{want.status !== "REJECTED" && want.status !== "CLOSED" && <button disabled={busy === want.id} onClick={() => void moderate(want.id, "REJECTED")} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700">Reject</button>}{want.status === "OPEN" && <button disabled={busy === want.id} onClick={() => void moderate(want.id, "CLOSED")} className="rounded-xl border border-borderGray px-4 py-2 text-sm font-bold text-darkText">Close</button>}</div></div></article>)}</div> : <div className="mt-7 rounded-2xl border border-borderGray bg-white p-10 text-center text-darkText/55">No Wants submitted yet.</div>}</main>;
}
