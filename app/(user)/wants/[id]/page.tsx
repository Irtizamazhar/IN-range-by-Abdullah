"use client";
import { useCallback, useEffect, useState } from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { WantCard, type WantSummary } from "@/components/user/WantCard";
export default function WantPage({ params }: { params: { id: string } }) {
  const { isCustomer, openAuthModal } = useCustomerAuth(); const [want, setWant] = useState<(WantSummary & { description: string; status: string }) | null>(null); const [message, setMessage] = useState("Loading…"); const [joined, setJoined] = useState(false); const [busy, setBusy] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    try { const r = await fetch(`/api/wants/${params.id}`, { signal }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setWant(d.want); setMessage(""); if (isCustomer) { const s = await fetch(`/api/wants/${params.id}/interest`, { signal }); if (s.ok) setJoined((await s.json()).joined); } } catch(e) { if (!signal?.aborted) setMessage(e instanceof Error ? e.message : "Could not load Want."); }
  }, [params.id, isCustomer]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);
  async function toggle() { if (!isCustomer) { openAuthModal("login"); return; } setBusy(true); try { const r = await fetch(`/api/wants/${params.id}/interest`, { method: joined ? "DELETE" : "PUT" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setJoined(d.joined); await load(); } catch(e) { setMessage(e instanceof Error ? e.message : "Could not save interest."); } finally { setBusy(false); } }
  return <main className="mx-auto max-w-3xl px-4 py-10"><h1 className="mb-5 text-3xl font-bold">Want details</h1><p role="status">{message}</p>{want && <><WantCard want={want} /><p className="my-5 whitespace-pre-wrap">{want.description}</p>{want.status === "OPEN" && <><button disabled={busy} aria-pressed={joined} onClick={() => void toggle()} className="rounded-xl bg-brand-primary px-5 py-3 font-bold">{joined ? "Leave interest" : "Mujhe Bhi Chahiye"}</button><p className="mt-3 text-sm text-gray-600">Interest does not place an order, reserve stock, or charge money.</p></>}{want.status === "PENDING_MODERATION" && <p>Your Want is awaiting moderation.</p>}</>}</main>;
}