"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
export function NewsletterSignup({ compact = false }: { compact?: boolean }) {
  const { data: session, status: sessionStatus } = useSession();
  const customer = session?.user?.role === "customer";
  const [email, setEmail] = useState(""), [status, setStatus] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { const controller = new AbortController(); if (customer) fetch("/api/newsletter", { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(row => { if (row) setStatus(row.status); }).catch(() => {}); return () => controller.abort(); }, [customer, session?.user?.id]);
  async function submit(unsubscribe = false) { setBusy(true); setMessage(""); try { const response = await fetch("/api/newsletter", { method: unsubscribe ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: unsubscribe ? undefined : JSON.stringify({ consent: true, ...(customer ? {} : { email }) }) }); const result = await response.json(); if (!response.ok) throw Error(result.error || "Please try again."); setMessage(unsubscribe ? "You are unsubscribed." : result.message); setStatus(unsubscribe ? "UNSUBSCRIBED" : "PENDING"); } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); } finally { setBusy(false); } }
  return <section aria-label="JORO newsletter" className={compact ? "space-y-3 rounded-xl bg-emerald-50 p-4" : "mx-auto my-8 max-w-site rounded-2xl bg-emerald-950 p-6 text-white sm:p-8"}>
    <h2 className="text-lg font-bold">Keep in touch with JORO</h2><p className="mt-2 text-sm">Opt in to product news and JORO updates. Unsubscribe any time.</p>
    {status === "SUBSCRIBED" ? <button disabled={busy} onClick={() => void submit(true)} className="mt-3 min-h-11 rounded-xl border px-4 py-2">Unsubscribe</button> : <form className="mt-4 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void submit(); }}>
      {!customer && <label className="min-w-0 flex-1"><span className="sr-only">Email address</span><input type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Your email address" className="min-h-11 w-full rounded-xl border bg-white px-4 text-emerald-950" /></label>}
      <button disabled={busy || sessionStatus === "loading"} className="min-h-11 rounded-xl bg-brand-primary px-5 py-2 font-bold text-brand-dark">{busy ? "Please wait…" : "Subscribe"}</button>
    </form>}
    <p role="status" className="mt-2 text-sm">{message}</p><a className="text-xs underline" href="/privacy-policy">Privacy policy</a>
  </section>;
}
