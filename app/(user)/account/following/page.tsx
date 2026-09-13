"use client";
import { useEffect, useState } from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { StoreCard, type PublicStore } from "@/components/user/StoreCard";
export default function FollowingPage() {
  const { isCustomer, openAuthModal, authLoading } = useCustomerAuth();
  const [stores, setStores] = useState<PublicStore[]>([]);
  const [message, setMessage] = useState("Loading…");
  useEffect(() => {
    if (!isCustomer) return;
    const controller = new AbortController();
    fetch("/api/account/following", { signal: controller.signal }).then(async r => {
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      setStores(data.stores); setMessage(data.stores.length ? "" : "You are not following any stores yet.");
    }).catch(e => { if (!controller.signal.aborted) setMessage(e.message); });
    return () => controller.abort();
  }, [isCustomer]);
  return <main className="mx-auto max-w-7xl px-4 py-10"><h1 className="mb-6 text-3xl font-bold">Following</h1>{!isCustomer ? <button disabled={authLoading} onClick={() => openAuthModal("login")} className="rounded-xl bg-brand-primary px-5 py-3">Sign in to view followed stores</button> : <><p role="status">{message}</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{stores.map(store => <StoreCard key={store.id} store={store} />)}</div></>}</main>;
}