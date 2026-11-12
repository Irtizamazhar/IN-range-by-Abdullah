"use client";
import { useState } from "react";
export function NewsletterAction({ action }: { action: "confirm" | "unsubscribe" }) {
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function submit() { setBusy(true); try { const token = new URLSearchParams(location.hash.slice(1)).get("token"); const r = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, token }) }); const data = await r.json(); if (!r.ok) throw Error(data.error); history.replaceState(null, "", location.pathname); setMessage(action === "confirm" ? "Subscription confirmed." : "You have been unsubscribed."); } catch (e) { setMessage(e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); } }
  return <main className="mx-auto max-w-xl space-y-5 px-4 py-12"><h1 className="text-2xl font-bold">{action === "confirm" ? "Confirm newsletter subscription" : "Unsubscribe from the newsletter"}</h1><p>Confirm your choice below. Opening this page alone does not change your subscription.</p><button disabled={busy} onClick={() => void submit()} className="min-h-11 rounded-xl bg-emerald-900 px-5 py-3 text-white">{busy ? "Please wait…" : action === "confirm" ? "Confirm subscription" : "Unsubscribe"}</button><p role="status">{message}</p></main>;
}
