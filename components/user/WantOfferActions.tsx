"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export function WantOfferActions({ wantId, offerId }: { wantId: string; offerId: string }) {
  const [rejected, setRejected] = useState(false);
  const [busy, setBusy] = useState(false);
  async function reject() {
    setBusy(true);
    try {
      const response = await fetch(`/api/wants/${wantId}/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) return toast.error(data.error || "Could not reject offer");
      setRejected(true);
    } finally {
      setBusy(false);
    }
  }
  if (rejected) return <span className="text-sm font-bold text-red-600">Offer rejected</span>;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button disabled title="Payment provider and return policy must be configured first" className="cursor-not-allowed rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-brand-dark opacity-55">Continue to checkout</button>
      <button disabled={busy} onClick={() => void reject()} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">Reject</button>
      <p className="w-full text-xs text-darkText/45">Offer checkout stays disabled until payment, commission, and return policies are configured.</p>
    </div>
  );
}
