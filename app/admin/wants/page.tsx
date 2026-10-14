"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { Eye, Flag, ImageOff } from "lucide-react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { ContainedImage } from "@/components/user/ContainedImage";
import { formatPKR } from "@/lib/format";
import { WANT_REACTIONS, WANT_REPORT_REASONS } from "@/lib/want-social";

type Want = { id: string; title: string; description: string | null; requestType: string; category: string; city: string; budgetMax: unknown; photo: string | null; status: string; moderationReason: string | null; createdAt: string; customer: { name: string; email: string; isActive: boolean }; _count: { offers: number; interests: number; reactions: number; reports: number } };
type Stats = { byStatus: Record<string, number>; reactions: number; joins: number; offers: number; openReports: number };
type Account = { customer: { id: string; name: string; email: string; isActive: boolean } | null; vendor: { id: string; shopName: string; email: string; status: string } | null };
type Report = Account & { id: string; reason: string; details: string | null; status: string; reviewedBy: string | null; createdAt: string };
type Reaction = Account & { id: string; type: string; updatedAt: string };

const FILTERS = [["pending", "Pending"], ["open", "Live"], ["reported", "Reported"], ["hidden", "Hidden / rejected"], ["all", "All"]] as const;
const reasonLabel = (value: string) => WANT_REPORT_REASONS.find((reason) => reason.value === value)?.label || value;
const reactionEmoji = (value: string) => WANT_REACTIONS.find((reaction) => reaction.type === value)?.emoji || value;
function who(row: Account) {
  if (row.customer) return `${row.customer.name || "Customer"} · ${row.customer.email}${row.customer.isActive ? "" : " (deactivated)"}`;
  if (row.vendor) return `${row.vendor.shopName} (vendor) · ${row.vendor.email}${row.vendor.status === "approved" ? "" : ` (${row.vendor.status})`}`;
  return "Removed account";
}

async function readJson<T>(response: Response) { return (await response.json().catch(() => ({}))) as T & { error?: string }; }

function ReviewPanel({ want, onChanged }: { want: Want; onChanged: () => void }) {
  const [data, setData] = useState<{ reports: Report[]; reactions: Reaction[] } | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/wants/${want.id}`, { cache: "no-store" });
      const body = await readJson<{ reports: Report[]; reactions: Reaction[] }>(response);
      if (!response.ok) throw new Error(body.error || "Could not load reports and reactions.");
      setData({ reports: body.reports, reactions: body.reactions }); setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load reports and reactions."); }
  }, [want.id]);
  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, string>, success: string) {
    const reason = window.prompt("Reason (kept in the audit log):")?.trim();
    if (!reason) return;
    const response = await fetch(`/api/admin/wants/${want.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, reason }) });
    const result = await readJson<object>(response);
    if (!response.ok) return toast.error(result.error || "Could not update.");
    toast.success(success); await load(); onChanged();
  }

  if (error) return <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="mt-4 text-sm text-darkText/55">Loading reports and reactions…</p>;
  const openReports = data.reports.filter((report) => report.status === "OPEN");
  return <div className="mt-4 grid gap-4 border-t border-borderGray pt-4 lg:grid-cols-2">
    <section>
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-black text-darkText">Reports ({data.reports.length})</h3>{openReports.length > 0 && <LoadingButton onClick={() => act({ action: "dismissReports" }, "Reports dismissed")} className="rounded-lg border border-borderGray px-3 py-1.5 text-xs font-bold">Dismiss open reports</LoadingButton>}</div>
      {data.reports.length ? <ul className="mt-2 space-y-2">{data.reports.map((report) => <li key={report.id} className="rounded-xl bg-lightGray p-3 text-xs"><p className="font-bold text-darkText">{reasonLabel(report.reason)} <span className="font-semibold text-darkText/50">· {report.status.toLowerCase()}</span></p>{report.details && <p className="mt-1 text-darkText/70">{report.details}</p>}<p className="mt-1 text-darkText/50">{who(report)} · {new Date(report.createdAt).toLocaleString("en-PK")}</p></li>)}</ul> : <p className="mt-2 text-xs text-darkText/50">No reports.</p>}
    </section>
    <section>
      <h3 className="text-sm font-black text-darkText">Reactions ({data.reactions.length})</h3>
      {data.reactions.length ? <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">{data.reactions.map((reaction) => <li key={reaction.id} className="flex items-center justify-between gap-2 rounded-lg bg-lightGray px-3 py-2 text-xs"><span className="min-w-0 truncate"><span aria-label={reaction.type}>{reactionEmoji(reaction.type)}</span> {who(reaction)}</span><LoadingButton onClick={() => act({ action: "removeReaction", reactionId: reaction.id }, "Reaction removed")} className="shrink-0 font-bold text-red-700">Remove</LoadingButton></li>)}</ul> : <p className="mt-2 text-xs text-darkText/50">No reactions.</p>}
      <p className="mt-3 text-xs text-darkText/55">Repeated misuse? Suspend the account from <Link href="/admin/customers" className="font-bold underline">Customers</Link> or <Link href="/admin/vendors" className="font-bold underline">Vendors</Link>.</p>
    </section>
  </div>;
}

export default function AdminWantsPage() {
  const [wants, setWants] = useState<Want[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("pending");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [viewing, setViewing] = useState<Want | null>(null);
  const [reviewing, setReviewing] = useState("");
  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`/api/admin/wants?filter=${filter}`, { cache: "no-store" });
      const data = await readJson<{ wants?: Want[]; stats?: Stats }>(response);
      if (!response.ok) throw new Error(data.error || "Could not load Wants");
      setWants(data.wants || []); setStats(data.stats || null);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load Wants. Please try again.");
    } finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);
  async function moderate(id: string, status: "OPEN" | "REJECTED" | "CLOSED") {
    let reason = "Approved.";
    if (status === "REJECTED") { const note = window.prompt("Reason shown to the customer:")?.trim(); if (!note) return; reason = note; }
    if (status === "CLOSED") { const note = window.prompt("Reason for hiding this Want (shown to the customer):")?.trim(); if (!note) return; reason = note; }
    const response = await fetch("/api/admin/wants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, reason }) });
    const data = await readJson<object>(response);
    if (!response.ok) return toast.error(data.error || "Could not update Want");
    toast.success("Want updated");
    await load(false);
  }
  const tiles = stats ? [
    ["Pending", (stats.byStatus.PENDING_MODERATION || 0) + (stats.byStatus.SUBMITTED || 0)],
    ["Live", stats.byStatus.OPEN || 0],
    ["Hidden / rejected", (stats.byStatus.CLOSED || 0) + (stats.byStatus.REJECTED || 0)],
    ["Open reports", stats.openReports],
    ["Reactions", stats.reactions],
    ["Joins", stats.joins],
    ["Vendor offers", stats.offers],
  ] as const : [];
  return <main className="p-6 md:p-8"><h1 className="text-2xl font-black text-darkText">Wants moderation</h1><p className="mt-1 text-sm text-darkText/60">Approve customer demand before it goes public, hide abusive posts and review reports. Actions are recorded in audit history.</p>
    {tiles.length > 0 && <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">{tiles.map(([label, value]) => <div key={label} className="rounded-xl border border-borderGray bg-white p-3"><dt className="text-xs font-bold text-darkText/50">{label}</dt><dd className="mt-1 text-xl font-black text-[#005235]">{value.toLocaleString("en-PK")}</dd></div>)}</dl>}
    <nav aria-label="Filter Wants" className="mt-5 flex flex-wrap gap-2">{FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === id ? "bg-[#005235] text-white" : "border border-borderGray bg-white text-darkText/70"}`}>{label}</button>)}</nav>
    {loadError && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4"><p role="alert" className="text-sm text-red-800">{loadError}</p><LoadingButton type="button" onClick={() => load(false)} loadingLabel="Retrying…" className="mt-3 rounded-lg bg-brand-primary px-4 py-2 text-sm font-bold text-brand-dark">Try again</LoadingButton></div>}
    {loading ? <PageSkeleton rows={3} /> : wants.length ? <div className="mt-6 space-y-4">{wants.map((want) => <article key={want.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 max-w-3xl flex-col gap-4 sm:flex-row">
      {/* Customer's reference image, shown whole so the admin can check it before approving. */}
      <div className="relative aspect-[4/3] w-full shrink-0 self-start overflow-hidden rounded-xl border border-borderGray bg-[#F4F8EF] sm:w-44">
        <ContainedImage src={want.photo} sizes="176px" fallback={<span className="flex flex-col items-center gap-1 text-xs text-darkText/40"><ImageOff className="h-6 w-6" aria-hidden="true" />No image</span>} />
        {want.photo && <button type="button" onClick={() => setViewing(want)} aria-label={`View image for ${want.title}`} className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-emerald-950 shadow hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"><Eye className="h-3.5 w-3.5" aria-hidden="true" />View</button>}
      </div>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-link">{want.requestType.charAt(0) + want.requestType.slice(1).toLowerCase()} · {want.category}</span><span className="rounded-full border border-borderGray px-2.5 py-1 text-xs font-bold capitalize">{want.status === "CLOSED" ? "hidden / closed" : want.status.replaceAll("_", " ").toLowerCase()}</span>{want._count.reports > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700"><Flag className="h-3.5 w-3.5" aria-hidden="true" />{want._count.reports} open {want._count.reports === 1 ? "report" : "reports"}</span>}{!want.customer?.isActive && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">Owner deactivated</span>}</div><h2 className="mt-3 text-lg font-black text-darkText">{want.title}</h2><p className="mt-2 text-sm leading-6 text-darkText/60">{want.description}</p><p className="mt-3 text-xs text-darkText/45">{want.customer?.name} · {want.customer?.email} · {want.city} · {want._count.offers} offers · {want._count.interests} joined · {want._count.reactions} reactions{want.budgetMax ? ` · Up to ${formatPKR(Number(want.budgetMax))}` : ""}</p>{want.moderationReason && <p className="mt-2 text-xs font-semibold text-red-700">Note: {want.moderationReason}</p>}</div></div>
      <div className="flex shrink-0 flex-wrap gap-2">{["PENDING_MODERATION", "SUBMITTED", "REJECTED"].includes(want.status) && <LoadingButton loadingLabel="Processing…" onClick={() => moderate(want.id, "OPEN")} className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-brand-dark">Approve</LoadingButton>}{want.status !== "REJECTED" && want.status !== "CLOSED" && <LoadingButton loadingLabel="Processing…" onClick={() => moderate(want.id, "REJECTED")} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700">Reject</LoadingButton>}{want.status === "OPEN" && <LoadingButton loadingLabel="Processing…" onClick={() => moderate(want.id, "CLOSED")} className="rounded-xl border border-borderGray px-4 py-2 text-sm font-bold text-darkText">Hide</LoadingButton>}<button type="button" aria-expanded={reviewing === want.id} onClick={() => setReviewing((current) => current === want.id ? "" : want.id)} className="rounded-xl border border-borderGray px-4 py-2 text-sm font-bold text-[#005235]">{reviewing === want.id ? "Close review" : "Review reports & reactions"}</button></div></div>
      {reviewing === want.id && <ReviewPanel want={want} onChanged={() => void load(false)} />}
    </article>)}</div> : !loadError ? <div className="mt-7 rounded-2xl border border-borderGray bg-white p-10 text-center text-darkText/55">No Wants in this view.</div> : null}{viewing?.photo && <ImageLightbox images={[viewing.photo]} title={viewing.title} onClose={() => setViewing(null)} />}</main>;
}
