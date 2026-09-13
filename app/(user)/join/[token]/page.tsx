"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
export default function JoinRoom({ params }: { params: { token: string } }) {
  const { isCustomer, openAuthModal } = useCustomerAuth(); const router = useRouter(); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function join() { if (!isCustomer) { openAuthModal("login"); return; } setBusy(true); try { const r = await fetch("/api/together/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: params.token }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); router.replace(`/together/${d.roomId}`); } catch(e) { setMessage(e instanceof Error ? e.message : "Could not join."); } finally { setBusy(false); } }
  return <main className="mx-auto max-w-xl p-8"><h1 className="text-3xl font-bold">Join a shopping room</h1><p className="my-4">Room members can see your name, suggestions, votes, and comments. Your personal checkout stays private.</p><button disabled={busy} onClick={() => void join()} className="rounded-xl bg-brand-primary p-3 font-bold">{busy ? "Joining…" : "Join room"}</button><p className="mt-4" role="status">{message}</p></main>;
}