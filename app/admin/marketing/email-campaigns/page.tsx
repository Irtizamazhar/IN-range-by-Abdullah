"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeDescriptionHtml } from "@/lib/security/sanitize";
import Image from "next/image";
import brandLogo from "@/public/logo.png";

type Campaign = { id: string; subject: string; previewText: string; bodyHtml: string; audience: string; recipientIds: string[] | null; status: string; lastTestAt: string | null; lastTestStatus: string | null; updatedAt: string };
type Recipient = { id: string; name: string; email: string; type: string; eligible: boolean };
const empty = { id: "", subject: "", previewText: "", bodyHtml: "<p>Hello from JORO!</p>", audience: "CUSTOMERS", recipientIds: [] as string[] };

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState(empty);
  const [eligible, setEligible] = useState({ customers: 0, vendors: 0 });
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"customers" | "vendors">("customers");
  const [results, setResults] = useState<Recipient[]>([]);
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("desktop");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editor = useRef<HTMLTextAreaElement>(null);

  async function load() {
    const response = await fetch("/api/admin/email-campaigns", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load campaigns.");
    const data = await response.json();
    setCampaigns(data.campaigns);
    setEligible({ customers: data.eligibleCustomers, vendors: data.eligibleVendors });
  }
  useEffect(() => { load().catch(() => setError("Could not load campaigns.")); }, []);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/admin/email-campaigns/recipients?type=${type}&q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then(response => response.ok ? response.json() : null)
        .then(data => { if (!controller.signal.aborted) setResults(data?.recipients || []); })
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, type]);

  function format(open: string, close: string) {
    const input = editor.current;
    if (!input) return;
    const start = input.selectionStart, end = input.selectionEnd;
    const next = form.bodyHtml.slice(0, start) + open + form.bodyHtml.slice(start, end) + close + form.bodyHtml.slice(end);
    setForm(previous => ({ ...previous, bodyHtml: next }));
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + open.length, end + open.length); });
  }

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/email-campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save draft.");
      setForm(previous => ({ ...previous, id: data.campaign.id }));
      await load();
      setMessage("Draft saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save draft."); }
    finally { setBusy(false); }
  }

  async function sendTest() {
    if (!form.id || !window.confirm("Send one test email to your signed-in admin address?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/email-campaigns/${form.id}/test`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Test email failed.");
      await load();
      setMessage("Mail provider accepted the test email.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Test email failed."); await load().catch(() => {}); }
    finally { setBusy(false); }
  }

  const field = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#005055]";
  return <main className="mx-auto max-w-7xl space-y-6 p-4 text-slate-900 sm:p-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Marketing</p><h1 className="mt-1 text-3xl font-black text-[#005055]">Email Campaigns</h1><p className="mt-2 text-sm text-slate-600">Create branded drafts and send a test to your admin address. Promotional delivery is disabled until a bulk provider and explicit consent are ready.</p></header>
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <section aria-label="Campaign editor" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{form.id ? "Edit draft" : "New draft"}</h2><button type="button" onClick={() => setForm(empty)} className="text-sm font-semibold text-emerald-800 underline">New campaign</button></div>
        <label className="block text-sm font-semibold">Subject<input className={`${field} mt-1`} maxLength={200} value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} /></label>
        <label className="block text-sm font-semibold">Preview text<input className={`${field} mt-1`} maxLength={240} value={form.previewText} onChange={event => setForm({ ...form, previewText: event.target.value })} /></label>
        <div><label htmlFor="campaign-body" className="text-sm font-semibold">Message</label><div role="toolbar" aria-label="Message formatting" className="mt-2 flex flex-wrap gap-2">{[["Bold", "<strong>", "</strong>"], ["Italic", "<em>", "</em>"], ["Paragraph", "<p>", "</p>"], ["List", "<ul><li>", "</li></ul>"]] .map(([label, open, close]) => <button key={label} type="button" onClick={() => format(open, close)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-50">{label}</button>)}</div><textarea id="campaign-body" ref={editor} className={`${field} mt-2 min-h-48 font-mono`} value={form.bodyHtml} onChange={event => setForm({ ...form, bodyHtml: event.target.value })} aria-describedby="campaign-editor-hint" /><p id="campaign-editor-hint" className="mt-1 text-xs text-slate-500">Only safe text formatting is retained when saved. Links, scripts and images are removed.</p></div>
        <label className="block text-sm font-semibold">Audience<select className={`${field} mt-1`} value={form.audience} onChange={event => setForm({ ...form, audience: event.target.value })}><option value="CUSTOMERS">Customers</option><option value="VENDORS">Vendors</option><option value="BOTH">Customers and vendors</option><option value="INDIVIDUAL">Selected people</option></select></label>
        <div className="rounded-xl bg-slate-50 p-3 text-sm"><p>Eligible opted-in customers: <strong>{eligible.customers}</strong></p><p>Eligible opted-in vendors: <strong>{eligible.vendors}</strong></p><p>Selected individuals: <strong>{form.recipientIds.length}</strong></p></div>
        <div className="space-y-2"><label htmlFor="recipient-search" className="text-sm font-semibold">Find individual recipients</label><div className="grid gap-2 sm:grid-cols-[130px_1fr]"><select className={field} value={type} onChange={event => setType(event.target.value as typeof type)} aria-label="Recipient type"><option value="customers">Customers</option><option value="vendors">Vendors</option></select><input id="recipient-search" className={field} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name or email" /></div><ul className="max-h-48 overflow-y-auto">{results.map(person => <li key={person.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2 text-xs"><span className="min-w-0 truncate">{person.name} · {person.email} {!person.eligible && <span className="text-amber-700">(no consent)</span>}</span><button type="button" onClick={() => setForm(previous => ({ ...previous, recipientIds: previous.recipientIds.includes(person.id) ? previous.recipientIds.filter(id => id !== person.id) : [...previous.recipientIds, person.id] }))} className="shrink-0 font-bold text-emerald-800">{form.recipientIds.includes(person.id) ? "Remove" : "Select"}</button></li>)}</ul></div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={save} className="rounded-xl bg-[#005055] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save draft"}</button><button type="button" disabled={busy || !form.id} onClick={sendTest} className="rounded-xl border border-[#005055] px-5 py-2.5 text-sm font-bold text-[#005055] disabled:opacity-50">Send test email</button><button type="button" disabled title="Bulk sending is disabled until a bulk provider and marketing consent are configured" className="rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-bold text-slate-500">Send campaign</button></div>
      </section>
      <div className="space-y-6"><section aria-label="Campaign preview" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Preview</h2><div className="flex gap-2 text-xs"><button type="button" aria-pressed={previewMode === "mobile"} onClick={() => setPreviewMode("mobile")} className="underline">Mobile</button><button type="button" aria-pressed={previewMode === "desktop"} onClick={() => setPreviewMode("desktop")} className="underline">Desktop</button></div></div><div className={`mx-auto mt-4 overflow-hidden rounded-xl border border-emerald-100 bg-white ${previewMode === "mobile" ? "max-w-[360px]" : "max-w-[600px]"}`}><div className="border-t-4 border-[#005055] p-4 text-center"><Image src={brandLogo} alt="JORO" width={150} height={84} className="mx-auto h-auto w-[150px]" /></div><div className="p-5"><p className="text-xs font-bold text-lime-700">Jo Chahiye, Yahin Mile!</p><h3 className="mt-3 text-xl font-bold text-[#005055]">{form.subject || "Your subject"}</h3><p className="mt-1 text-xs text-slate-500">{form.previewText}</p><div className="prose prose-sm mt-5 max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeDescriptionHtml(form.bodyHtml) }} /></div></div></section><section aria-label="Campaign history" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-xl font-bold">History</h2><p className="mt-1 text-xs text-slate-500">Drafts and test delivery results. No bulk campaigns have been sent.</p><ul className="mt-3 space-y-2">{campaigns.map(campaign => <li key={campaign.id}><button type="button" onClick={() => setForm({ id: campaign.id, subject: campaign.subject, previewText: campaign.previewText, bodyHtml: campaign.bodyHtml, audience: campaign.audience, recipientIds: Array.isArray(campaign.recipientIds) ? campaign.recipientIds : [] })} className="w-full rounded-xl border border-slate-200 p-3 text-left text-sm hover:bg-emerald-50"><strong className="block truncate">{campaign.subject}</strong><span className="text-xs text-slate-600">{campaign.status} · Test: {campaign.lastTestStatus || "not sent"} · {new Date(campaign.updatedAt).toLocaleDateString("en-PK")}</span></button></li>)}</ul></section></div>
    </div>
  </main>;
}
