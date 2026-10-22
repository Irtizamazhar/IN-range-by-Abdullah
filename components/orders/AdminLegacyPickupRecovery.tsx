"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export function AdminLegacyPickupRecovery({ shopOrderId, vendor, onSuccess }: { shopOrderId: string; vendor?: { ownerName: string; phone: string; city: string }; onSuccess: () => Promise<void> }) {
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCity, setPickupCity] = useState(vendor?.city || "");
  const [contactName, setContactName] = useState(vendor?.ownerName || "");
  const [contactPhone, setContactPhone] = useState(vendor?.phone || "");
  const [parcelCount, setParcelCount] = useState(1);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [verifiedOrder, setVerifiedOrder] = useState(false);
  const [busy, setBusy] = useState(false);

  async function recover() {
    setBusy(true);
    try {
      const response = await fetch("/api/orders/admin/pickups/recover", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ shopOrderId, pickupAddress, pickupCity, contactName, contactPhone, parcelCount, reason, evidence, verifiedOrder }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create recovery request");
      toast.success("Recovery request recorded. Schedule and verify collection in Pickup Management.");
      await onSuccess();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create recovery request"); }
    finally { setBusy(false); }
  }

  return <section className="mt-6 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
    <h2 className="font-bold text-amber-950">Admin recovery for a legacy packed order</h2>
    <p>Use only when the vendor cannot request pickup. Verify the physical parcel and pickup contact first. This creates a request; courier collection and handover remain separate recorded steps.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Verified pickup address<input className="mt-1 w-full rounded border p-2" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} /></label>
      <label>City<input className="mt-1 w-full rounded border p-2" value={pickupCity} onChange={e => setPickupCity(e.target.value)} /></label>
      <label>Pickup contact<input className="mt-1 w-full rounded border p-2" value={contactName} onChange={e => setContactName(e.target.value)} /></label>
      <label>Contact phone<input className="mt-1 w-full rounded border p-2" value={contactPhone} onChange={e => setContactPhone(e.target.value)} /></label>
      <label>Parcel count<input type="number" min={1} max={100} className="mt-1 w-full rounded border p-2" value={parcelCount} onChange={e => setParcelCount(Number(e.target.value))} /></label>
      <label>Reason for intervention<input className="mt-1 w-full rounded border p-2" value={reason} onChange={e => setReason(e.target.value)} /></label>
      <label className="sm:col-span-2">Pickup verification evidence or reference<input className="mt-1 w-full rounded border p-2" value={evidence} onChange={e => setEvidence(e.target.value)} /></label>
    </div>
    <label className="flex items-center gap-2"><input type="checkbox" checked={verifiedOrder} onChange={e => setVerifiedOrder(e.target.checked)} />I verified this Packed order, parcel and pickup details.</label>
    <button type="button" disabled={busy || !verifiedOrder || pickupAddress.trim().length < 10 || reason.trim().length < 10 || evidence.trim().length < 10} onClick={recover} className="rounded-lg bg-amber-900 px-4 py-2 font-bold text-white disabled:opacity-50">Record recovery request</button>
  </section>;
}
