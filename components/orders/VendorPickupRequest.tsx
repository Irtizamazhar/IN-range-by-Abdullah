"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Pickup = { pickupReference: string; status: string; parcelCount: number; readyAt: string; visit?: { scheduledAt: string | null; courierName: string | null; agentName: string | null } | null };
type Prefill = { vendorName: string; pickupAddress: string; pickupCity: string; contactName: string; contactPhone: string };

export function VendorPickupRequest({ orderId, shopOrderNumber }: { orderId: string; shopOrderNumber: string }) {
  const [pickup, setPickup] = useState<Pickup | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [parcels, setParcels] = useState(1);
  const [weight, setWeight] = useState("");
  const [window, setWindow] = useState("");
  const [instructions, setInstructions] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch(`/api/orders/vendor/${encodeURIComponent(orderId)}/pickup`).then(r => r.json()).then(j => { if (j.prefill) setPrefill(j.prefill); if (j.pickup) setPickup(j.pickup); }).catch(() => toast.error("Could not load pickup details")); }, [orderId]);
  async function submit() {
    setBusy(true);
    try {
      const r = await fetch(`/api/orders/vendor/${encodeURIComponent(orderId)}/pickup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parcelCount: parcels, ...(weight ? { weightKg: Number(weight) } : {}), preferredWindow: window || undefined, instructions: instructions || undefined, packedConfirmed: confirmed }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "Could not request pickup");
      setPickup(j.pickup); toast.success(`Pickup requested: ${j.pickup.pickupReference}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not request pickup"); } finally { setBusy(false); }
  }
  return <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
    <h2 className="text-lg font-bold text-emerald-950">Ready for Pickup</h2>
    <p className="mt-1 text-sm text-emerald-900">Order {shopOrderNumber} · {prefill?.vendorName || "Your shop"}</p>
    {pickup ? <div className="mt-4 rounded-xl bg-white p-4 text-sm"><p className="font-bold text-emerald-900">Pickup {pickup.pickupReference}</p><p>Status: {pickup.status.replaceAll("_", " ")}</p><p>{pickup.parcelCount} parcel(s)</p>{pickup.visit?.scheduledAt ? <p>Scheduled: {new Date(pickup.visit.scheduledAt).toLocaleString()}</p> : null}{pickup.visit?.courierName || pickup.visit?.agentName ? <p>Assigned: {pickup.visit.courierName || pickup.visit.agentName}</p> : null}</div> : <>
      <div className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-700"><p className="font-semibold">Saved pickup location</p><p>{prefill?.pickupAddress || "Loading address…"}</p><p>{prefill?.pickupCity}</p><p>{prefill?.contactName} · {prefill?.contactPhone}</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Number of parcels<input className="mt-1 w-full rounded-lg border p-2" type="number" min="1" max="100" value={parcels} onChange={e => setParcels(Number(e.target.value))} /></label><label className="text-sm font-medium">Estimated weight (kg), optional<input className="mt-1 w-full rounded-lg border p-2" type="number" min="0.01" step="0.01" value={weight} onChange={e => setWeight(e.target.value)} /></label><label className="text-sm font-medium sm:col-span-2">Preferred pickup window<input className="mt-1 w-full rounded-lg border p-2" maxLength={255} value={window} onChange={e => setWindow(e.target.value)} placeholder="For example: tomorrow, 10 am–1 pm" /></label><label className="text-sm font-medium sm:col-span-2">Pickup instructions, optional<textarea className="mt-1 w-full rounded-lg border p-2" maxLength={2000} value={instructions} onChange={e => setInstructions(e.target.value)} /></label></div>
      <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm all items are packed and sealed.</label>
      <button className="mt-4 rounded-xl bg-emerald-800 px-5 py-2.5 font-bold text-white disabled:opacity-50" disabled={!confirmed || !prefill || busy} onClick={submit}>{busy ? "Submitting…" : "Request pickup"}</button>
    </>}
  </section>;
}
