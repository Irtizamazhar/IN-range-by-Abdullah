"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MapPin, MessageSquarePlus } from "lucide-react";
import { formatPKR } from "@/lib/format";

type Want = {
  id: string;
  title: string;
  description: string;
  category: string;
  city: string;
  budgetMin: number | null;
  budgetMax: number | null;
  quantity: number;
  condition: string | null;
  offerCount: number;
  myOffer: { id: string; amount: number; message: string; estimatedDays: number | null; status: string } | null;
};

export default function VendorWantsPage() {
  const [wants, setWants] = useState<Want[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/vendor/wants");
      const data = (await response.json()) as { wants?: Want[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load opportunities");
      setWants(data.wants || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load opportunities");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>, wantId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch(`/api/vendor/wants/${wantId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(form.get("amount")),
          message: String(form.get("message") || ""),
          estimatedDays: form.get("estimatedDays") ? Number(form.get("estimatedDays")) : null,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) return toast.error(data.error || "Could not save offer");
      toast.success("Offer saved");
      setEditing(null);
      await load();
    } finally { setBusy(false); }
  }

  return (
    <main className="p-6 md:p-8">
      <p className="text-sm font-black uppercase tracking-wider text-brand-link">Customer demand</p>
      <h1 className="mt-1 text-2xl font-black text-darkText">Demand Opportunities</h1>
      <p className="mt-1 text-sm text-darkText/60">Only moderated, open Wants are shown. Your offers are visible only to the customer who posted the Want.</p>
      {loading ? <p className="mt-8 text-darkText/50">Loading…</p> : wants.length ? <div className="mt-7 space-y-4">{wants.map((want) => <article key={want.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-link">{want.category}</span><span className="inline-flex items-center gap-1 text-xs font-semibold text-darkText/45"><MapPin className="h-3.5 w-3.5" />{want.city}</span></div><h2 className="mt-3 text-lg font-black text-darkText">{want.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-darkText/60">{want.description}</p></div><div className="shrink-0 text-sm sm:text-right"><p className="font-black text-brand-link">{want.budgetMax ? `Up to ${formatPKR(want.budgetMax)}` : "Flexible budget"}</p><p className="mt-1 text-xs text-darkText/45">{want.quantity} needed · {want.offerCount} offers</p></div></div>{want.myOffer ? <div className="mt-4 rounded-xl border border-brand-primary/25 bg-brand-soft p-4"><p className="text-xs font-black uppercase text-brand-link">Your {want.myOffer.status} offer</p><p className="mt-1 font-black text-darkText">{formatPKR(want.myOffer.amount)}</p><p className="mt-1 text-sm text-darkText/60">{want.myOffer.message}</p>{want.myOffer.status === "pending" && <button onClick={() => setEditing(editing === want.id ? null : want.id)} className="mt-3 text-sm font-bold text-brand-link">Edit offer</button>}</div> : <button onClick={() => setEditing(editing === want.id ? null : want.id)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-brand-dark"><MessageSquarePlus className="h-4 w-4" />Send offer</button>}{editing === want.id && <form onSubmit={(event) => void submit(event, want.id)} className="mt-4 grid gap-3 rounded-xl border border-borderGray bg-brand-background p-4 sm:grid-cols-2"><label className="text-sm font-bold text-darkText">Offer amount<input required min={1} type="number" name="amount" defaultValue={want.myOffer?.amount} className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5" /></label><label className="text-sm font-bold text-darkText">Estimated days<input min={1} max={365} type="number" name="estimatedDays" defaultValue={want.myOffer?.estimatedDays || ""} className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5" /></label><label className="text-sm font-bold text-darkText sm:col-span-2">Offer message<textarea required minLength={10} maxLength={2000} rows={3} name="message" defaultValue={want.myOffer?.message} className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5" /></label><button disabled={busy} className="rounded-xl bg-brand-dark px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "Saving…" : "Save offer"}</button></form>}</article>)}</div> : <div className="mt-7 rounded-2xl border border-borderGray bg-white p-10 text-center text-darkText/55">No open customer Wants right now.</div>}
    </main>
  );
}
