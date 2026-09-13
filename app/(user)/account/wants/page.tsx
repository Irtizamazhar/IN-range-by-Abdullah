"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { WantCard, type WantSummary } from "@/components/user/WantCard";
export default function MyWants() {
  const { isCustomer, openAuthModal } = useCustomerAuth(); const [wants, setWants] = useState<WantSummary[]>([]); const [message, setMessage] = useState("Loading…");
  useEffect(() => { if (!isCustomer) return; const controller = new AbortController(); fetch("/api/wants?mine=1", { signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setWants(data.wants); setMessage(data.wants.length ? "" : "You have not posted any Wants yet."); }).catch(e => { if (!controller.signal.aborted) setMessage(e.message); }); return () => controller.abort(); }, [isCustomer]);
  return <main className="mx-auto max-w-7xl p-6"><h1 className="mb-5 text-3xl font-bold">My Wants</h1><Link href="/wants/new" className="text-brand-link underline">Post a Want</Link>{!isCustomer ? <button onClick={() => openAuthModal("login")} className="m-4 rounded-xl bg-brand-primary p-3">Sign in</button> : <><p className="my-4" role="status">{message}</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{wants.map(w => <WantCard key={w.id} want={w} />)}</div></>}</main>;
}