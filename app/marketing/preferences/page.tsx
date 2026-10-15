"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/user/LogoMark";

export default function MarketingPreferencesPage() {
  const [state, setState] = useState<{ subscribed: boolean; type: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "unauthorized" | "error">("loading");
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    fetch("/api/marketing/preference", { cache: "no-store" })
      .then(async response => { if (response.status === 401) { setStatus("unauthorized"); return; } if (!response.ok) throw new Error(); setState(await response.json()); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, []);
  async function save(subscribed: boolean) {
    setStatus("saving"); setMessage(""); setSaveError("");
    try {
      const response = await fetch("/api/marketing/preference", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscribed }) });
      if (!response.ok) throw new Error();
      setState(previous => previous ? { ...previous, subscribed } : previous);
      setStatus("ready"); setMessage("Email preference saved.");
    } catch { setStatus("ready"); setSaveError("Could not save your preference. Please try again."); }
  }
  return <main className="flex min-h-dvh items-center justify-center bg-emerald-50 p-4"><section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg sm:p-8"><div className="mx-auto w-fit"><LogoMark href={null} /></div><h1 className="mt-4 text-center text-2xl font-bold text-[#005055]">Email preferences</h1><p className="mt-2 text-center text-sm text-slate-600">Choose whether JORO may send you promotional emails. Account, security and order messages are separate.</p>{status === "loading" && <p role="status" className="mt-6 text-center text-sm">Loading preferences…</p>}{status === "unauthorized" && <p className="mt-6 text-center text-sm">Please <Link className="font-bold text-emerald-800 underline" href="/login?role=customer&mode=signin&callbackUrl=%2Fmarketing%2Fpreferences">sign in</Link> to update your preference.</p>}{status === "error" && <p role="alert" className="mt-6 text-center text-sm text-red-700">Preferences are unavailable. Please try again later.</p>}{state && <div className="mt-6 space-y-4"><p className="text-center text-sm">Current choice: <strong>{state.subscribed ? "Subscribed" : "Not subscribed"}</strong></p><label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm"><input type="checkbox" checked={state.subscribed} disabled={status === "saving"} onChange={event => void save(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-800" /><span>I agree to receive promotional emails from JORO. I can unsubscribe at any time.</span></label></div>}{message && <p role="status" className="mt-4 text-center text-sm text-emerald-800">{message}</p>}{saveError && <p role="alert" className="mt-4 text-center text-sm text-red-700">{saveError}</p>}</section></main>;
}
