"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Eye, ImageOff } from "lucide-react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { ContainedImage } from "@/components/user/ContainedImage";
import { formatPKR } from "@/lib/format";

type Want = { id: string; title: string; description: string | null; category: string; city: string; budgetMax: unknown; photo: string | null; status: string; moderationReason: string | null; createdAt: string; customer: { name: string; email: string }; _count: { offers: number; interests: number } };

export default function AdminWantsPage() {
  const [wants, setWants] = useState<Want[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [viewing, setViewing] = useState<Want | null>(null);
  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/admin/wants");
      const data = (await response.json()) as { wants?: Want[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load Wants");
      setWants(data.wants || []);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load Wants. Please try again.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function moderate(id: string, status: "OPEN" | "REJECTED" | "CLOSED") {
    let reason = "Approved.";
    if (status === "REJECTED") { const note = window.prompt("Reason shown to the customer:")?.trim(); if (!note) return; reason = note; }
    if (status === "CLOSED") { const note = window.prompt("Reason for closing (shown to the customer):")?.trim(); if (!note) return; reason = note; }

      const response = await fetch("/api/admin/wants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, reason }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) return toast.error(data.error || "Could not update Want");
      toast.success("Want updated");
      await load(false);

  }
  return <main className="p-6 md:p-8"><h1 className="text-2xl font-black text-darkText">Wants moderation</h1><p className="mt-1 text-sm text-darkText/60">Approve customer demand before vendors can see it. Actions are recorded in audit history.</p>{loadError && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4"><p role="alert" className="text-sm text-red-800">{loadError}</p><LoadingButton type="button" onClick={() => load(false)} loadingLabel="Retrying…" className="mt-3 rounded-lg bg-brand-primary px-4 py-2 text-sm font-bold text-brand-dark">Try again</LoadingButton></div>}{loading ? <PageSkeleton rows={3} /> : wants.length ? <div className="mt-7 space-y-4">{wants.map((want) => <article key={want.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 max-w-3xl flex-col gap-4 sm:flex-row">
      {/* Customer's reference image, shown whole so the admin can check it before approving. */}
      <div className="relative aspect-[4/3] w-full shrink-0 self-start overflow-hidden rounded-xl border border-borderGray bg-[#F4F8EF] sm:w-44">
        <ContainedImage src={want.photo} sizes="176px" fallback={<span className="flex flex-col items-center gap-1 text-xs text-darkText/40"><ImageOff className="h-6 w-6" aria-hidden="true" />No image</span>} />
        {want.photo && <button type="button" onClick={() => setViewing(want)} aria-label={`View image for ${want.title}`} className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-emerald-950 shadow hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"><Eye className="h-3.5 w-3.5" aria-hidden="true" />View</button>}
      </div>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-link">{want.category}</span><span className="rounded-full border border-borderGray px-2.5 py-1 text-xs font-bold capitalize">{want.status.replaceAll("_", " ").toLowerCase()}</span></div><h2 className="mt-3 text-lg font-black text-darkText">{want.title}</h2><p className="mt-2 text-sm leading-6 text-darkText/60">{want.description}</p><p className="mt-3 text-xs text-darkText/45">{want.customer?.name} · {want.customer?.email} · {want.city} · {want._count.offers} offers · {want._count.interests} interested{want.budgetMax ? ` · Up to ${formatPKR(Number(want.budgetMax))}` : ""}</p>{want.moderationReason && <p className="mt-2 text-xs font-semibold text-red-700">Note: {want.moderationReason}</p>}</div></div><div className="flex shrink-0 flex-wrap gap-2">{["PENDING_MODERATION", "SUBMITTED", "REJECTED"].includes(want.status) && <LoadingButton loadingLabel="Processing…"  onClick={() => moderate(want.id, "OPEN")} className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-brand-dark">Approve</LoadingButton>}{want.status !== "REJECTED" && want.status !== "CLOSED" && <LoadingButton loadingLabel="Processing…"  onClick={() => moderate(want.id, "REJECTED")} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700">Reject</LoadingButton>}{want.status === "OPEN" && <LoadingButton loadingLabel="Processing…"  onClick={() => moderate(want.id, "CLOSED")} className="rounded-xl border border-borderGray px-4 py-2 text-sm font-bold text-darkText">Close</LoadingButton>}</div></div></article>)}</div> : !loadError ? <div className="mt-7 rounded-2xl border border-borderGray bg-white p-10 text-center text-darkText/55">No Wants submitted yet.</div> : null}{viewing?.photo && <ImageLightbox images={[viewing.photo]} title={viewing.title} onClose={() => setViewing(null)} />}</main>;
}
