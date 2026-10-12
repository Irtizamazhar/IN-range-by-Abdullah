"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { usePostWant } from "@/context/PostWantContext";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";

const LOCKED = ["FULFILLED", "EXPIRED", "CLOSED"];

/**
 * Edit/Delete icon buttons for the customer who posted the Want. Callers render it only for the owner;
 * the API enforces ownership again. Deleting announces `want-deleted` so lists drop the card in place.
 */
export function WantOwnerActions({ wantId, status, offerCount = 0, afterDelete, className = "" }: { wantId: string; status: string; offerCount?: number; afterDelete?: string; className?: string }) {
  const { openEditWant } = usePostWant();
  const router = useLoadingRouter();
  const [busy, setBusy] = useState(false);
  const editable = !LOCKED.includes(status);
  const deletable = status !== "FULFILLED";

  async function remove() {
    const warning = offerCount > 0 ? `\n\nSellers have already sent ${offerCount} offer${offerCount === 1 ? "" : "s"} on this want. It will be closed and hidden from the feed instead, and pending offers will be declined.` : "";
    if (!window.confirm(`Are you sure you want to delete this want?${warning}`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/wants/${wantId}`, { method: "DELETE" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not delete this want. Please try again.");
      toast.success(result?.closed ? "Want closed and hidden from the feed." : "Want deleted.");
      window.dispatchEvent(new CustomEvent("want-deleted", { detail: { id: wantId, closed: !!result?.closed } }));
      if (afterDelete) await router.push(afterDelete);
    } catch (failure) { toast.error(failure instanceof Error ? failure.message : "Could not delete this want."); }
    finally { setBusy(false); }
  }

  if (!editable && !deletable) return null;
  const button = "inline-flex h-8 w-8 items-center justify-center rounded-full border bg-white transition disabled:opacity-50";
  return <div className={`flex shrink-0 items-center gap-1.5 ${className}`}>
    {editable && <button type="button" title="Edit want" aria-label="Edit want" disabled={busy} onClick={() => openEditWant(wantId)} className={`${button} border-emerald-200 text-emerald-900 hover:bg-lime-50`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>}
    {deletable && <button type="button" title="Delete want" aria-label="Delete want" aria-busy={busy} disabled={busy} onClick={() => void remove()} className={`${button} border-red-200 text-red-700 hover:bg-red-50`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}</button>}
  </div>;
}
