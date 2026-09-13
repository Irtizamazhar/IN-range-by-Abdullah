"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
export function StoreFollowButton({ vendorId, initialCount }: { vendorId: string; initialCount: number }) {
  const { isCustomer, openAuthModal, authLoading } = useCustomerAuth();
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isCustomer) { setFollowing(false); return; }
    const controller = new AbortController();
    fetch(`/api/stores/${vendorId}/follow`, { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error("Could not load follow status.");
      const data = await r.json(); setFollowing(data.following); setCount(data.count);
    }).catch(error => { if (!controller.signal.aborted) toast.error(error.message); });
    return () => controller.abort();
  }, [vendorId, isCustomer]);
  async function toggle() {
    if (!isCustomer) { openAuthModal("login"); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/stores/${vendorId}/follow`, { method: following ? "DELETE" : "PUT" });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      setFollowing(data.following); setCount(data.count);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update follow."); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-3"><span className="text-sm">{count} Followers</span><button type="button" aria-pressed={following} disabled={busy || authLoading} onClick={() => void toggle()} className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-brand-dark disabled:opacity-50">{busy ? "Saving…" : following ? "Following" : "Follow"}</button></div>;
}