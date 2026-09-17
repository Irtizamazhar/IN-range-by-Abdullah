"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

type Vendor = { id: string; shopName: string; ownerName: string; storeSlug: string | null; status: string };
type Campaign = {
  id: string; vendorId: string; title: string; subtitle: string | null; desktopImage: string | null; mobileImage: string | null;
  ctaText: string; ctaHref: string | null; placement: string; priority: number; startAt: string; endAt: string | null;
  status: string; isSponsored: boolean; vendor: { shopName: string; storeSlug: string | null; status: string };
};

const PLACEMENTS: { value: string; label: string }[] = [
  { value: "HOMEPAGE_SPOTLIGHT", label: "Homepage Vendor Spotlight" },
  { value: "HOMEPAGE_BANNER", label: "Homepage Promotional Banner" },
  { value: "FEATURED_VENDOR_CARD", label: "Featured Vendor Card" },
];
const STATUSES = ["DRAFT", "ACTIVE", "DISABLED", "ARCHIVED"];

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadgeClass(s: string) {
  switch (s) {
    case "ACTIVE": return "bg-emerald-100 text-emerald-800";
    case "DISABLED": return "bg-neutral-200 text-neutral-800";
    case "ARCHIVED": return "bg-red-100 text-red-800";
    default: return "bg-amber-100 text-amber-900";
  }
}

async function uploadPromotionImage(file: File) {
  const fd = new FormData(); fd.append("file", file); fd.append("folder", "promotions-local");
  const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "same-origin" });
  const d = (await r.json()) as { url?: string; error?: string };
  if (!r.ok || !d.url) throw new Error(d.error || "Image upload failed");
  return d.url;
}

export default function VendorPromotionsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [desktopImage, setDesktopImage] = useState("");
  const [mobileImage, setMobileImage] = useState("");
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/vendor-promotions", { credentials: "same-origin" });
      const d = (await r.json()) as { campaigns?: Campaign[]; vendors?: Vendor[]; error?: string };
      if (!r.ok) { toast.error(d.error || "Could not load promotions"); return; }
      setCampaigns(d.campaigns || []); setVendors(d.vendors || []);
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filteredVendors = useMemo(() => {
    const q = vendorQuery.trim().toLowerCase();
    if (!q) return vendors.slice(0, 20);
    return vendors.filter(v => v.shopName.toLowerCase().includes(q) || v.ownerName.toLowerCase().includes(q) || (v.storeSlug || "").toLowerCase().includes(q)).slice(0, 20);
  }, [vendors, vendorQuery]);

  function startEdit(c: Campaign | null) {
    setEditing(c);
    setVendorId(c?.vendorId || "");
    setVendorQuery(c ? c.vendor.shopName : "");
    setDesktopImage(c?.desktopImage || "");
    setMobileImage(c?.mobileImage || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onFilePick(kind: "desktop" | "mobile", file: File | null) {
    if (!file) return;
    const setUploading = kind === "desktop" ? setUploadingDesktop : setUploadingMobile;
    const setImage = kind === "desktop" ? setDesktopImage : setMobileImage;
    setUploading(true);
    try { setImage(await uploadPromotionImage(file)); toast.success("Image uploaded"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setUploading(false); }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vendorId) { toast.error("Choose an approved vendor from the list first."); return; }
    const f = new FormData(e.currentTarget);
    const reason = String(f.get("reason") || "").trim();
    if (reason.length < 3) { toast.error("An audit reason is required."); return; }
    setBusy(true);
    try {
      const endAtRaw = String(f.get("endAt") || "");
      const r = await fetch("/api/admin/vendor-promotions", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}), vendorId, title: f.get("title"), subtitle: f.get("subtitle"),
          desktopImage, mobileImage, ctaText: f.get("ctaText"), ctaHref: String(f.get("ctaHref") || "").trim() || null,
          placement: f.get("placement"), priority: Number(f.get("priority")),
          startAt: new Date(String(f.get("startAt"))).toISOString(),
          endAt: endAtRaw ? new Date(endAtRaw).toISOString() : null,
          status: f.get("status"), isSponsored: f.get("isSponsored") === "on", reason,
        }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || "Could not save promotion");
      toast.success(editing ? "Promotion updated" : "Promotion created");
      startEdit(null); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save promotion"); }
    finally { setBusy(false); }
  }

  async function setStatus(c: Campaign, status: string) {
    const reason = window.prompt(`Reason for setting "${c.title}" to ${status}:`, status === "ACTIVE" ? "Enabling promotion." : "Disabling promotion.");
    if (reason === null) return;
    if (reason.trim().length < 3) { toast.error("An audit reason is required."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/vendor-promotions", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id: c.id, status, reason: reason.trim() }) });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || "Could not update status");
      toast.success("Status updated"); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update status"); }
    finally { setBusy(false); }
  }

  async function removeCampaign(c: Campaign) {
    const reason = window.prompt(`Reason for deleting "${c.title}":`, "No longer needed.");
    if (reason === null) return;
    if (reason.trim().length < 3) { toast.error("An audit reason is required."); return; }
    if (!window.confirm(`Permanently delete "${c.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/vendor-promotions?id=${encodeURIComponent(c.id)}&reason=${encodeURIComponent(reason.trim())}`, { method: "DELETE", credentials: "same-origin" });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || "Could not delete promotion");
      toast.success("Promotion deleted"); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete promotion"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <h1 className="text-2xl font-black text-darkText">Vendor Promotions</h1>
      <p className="mt-1 text-sm text-darkText/70">Sponsored / Featured Partner placements. Only approved, public vendors can be selected. These never affect the separate Top Vendors list.</p>

      <form key={editing?.id || "new"} onSubmit={e => void save(e)} className="joro-form mt-6 grid gap-4 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">{editing ? `Edit: ${editing.title}` : "Create promotion"}</h2>

        <div className="relative sm:col-span-2">
          <label htmlFor="vendorSearch">Approved vendor / store</label>
          <input id="vendorSearch" value={vendorQuery} onChange={e => { setVendorQuery(e.target.value); setVendorId(""); }} placeholder="Search by store name, owner, or slug…" autoComplete="off" required={!vendorId} />
          {vendorQuery && !vendorId ? (
            <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border bg-white shadow-lg">
              {filteredVendors.length ? filteredVendors.map(v => (
                <button type="button" key={v.id} onClick={() => { setVendorId(v.id); setVendorQuery(v.shopName); }} className="block w-full border-b px-4 py-2 text-left text-sm last:border-b-0 hover:bg-brand-soft">
                  <span className="font-bold">{v.shopName}</span> <span className="text-darkText/60">· {v.ownerName} · /stores/{v.storeSlug || v.id} · {v.status}</span>
                </button>
              )) : <p className="px-4 py-2 text-sm text-darkText/60">No approved vendor matches.</p>}
            </div>
          ) : null}
          {vendorId ? <p className="mt-1 text-xs font-bold text-emerald-700">Selected: {vendorQuery}</p> : null}
        </div>

        <label>Headline<input name="title" defaultValue={editing?.title} maxLength={160} required /></label>
        <label>Subtitle<input name="subtitle" defaultValue={editing?.subtitle || ""} maxLength={300} /></label>

        <label>Desktop image
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingDesktop} onChange={e => void onFilePick("desktop", e.target.files?.[0] || null)} />
          <input className="mt-1 text-xs" placeholder="or paste an https:// image URL" value={desktopImage} onChange={e => setDesktopImage(e.target.value)} />
          {desktopImage ? <img src={desktopImage} alt="Desktop preview" className="mt-2 h-20 w-full rounded-lg object-cover" /> : null}
        </label>
        <label>Mobile image
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingMobile} onChange={e => void onFilePick("mobile", e.target.files?.[0] || null)} />
          <input className="mt-1 text-xs" placeholder="or paste an https:// image URL" value={mobileImage} onChange={e => setMobileImage(e.target.value)} />
          {mobileImage ? <img src={mobileImage} alt="Mobile preview" className="mt-2 h-20 w-full rounded-lg object-cover" /> : null}
        </label>

        <label>CTA label<input name="ctaText" defaultValue={editing?.ctaText || "View Store"} required /></label>
        <label>CTA destination (optional)<input name="ctaHref" defaultValue={editing?.ctaHref || ""} placeholder="Leave blank to link to the vendor's store page" /></label>

        <label>Placement<select name="placement" defaultValue={editing?.placement || "HOMEPAGE_SPOTLIGHT"}>{PLACEMENTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label>Priority (higher shows first)<input name="priority" type="number" defaultValue={editing?.priority ?? 0} min={0} max={1000} required /></label>

        <label>Starts<input type="datetime-local" name="startAt" defaultValue={toLocalInput(editing?.startAt || null)} required /></label>
        <label>Ends (optional — blank runs indefinitely)<input type="datetime-local" name="endAt" defaultValue={toLocalInput(editing?.endAt || null)} /></label>

        <label>Status<select name="status" defaultValue={editing?.status || "DRAFT"}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="flex items-center gap-2 self-end"><input type="checkbox" name="isSponsored" defaultChecked={editing?.isSponsored ?? true} /> Show &quot;Sponsored&quot; label (unchecked shows &quot;Featured Partner&quot;)</label>

        <label className="sm:col-span-2">Audit reason<input name="reason" minLength={3} placeholder="Why is this change being made?" required /></label>

        <div className="flex items-center gap-3 sm:col-span-2">
          <button disabled={busy || uploadingDesktop || uploadingMobile} className="rounded-xl bg-brand-primary px-5 py-3 font-bold text-brand-dark disabled:opacity-50">{busy ? "Saving…" : editing ? "Update promotion" : "Create promotion"}</button>
          {editing ? <button type="button" onClick={() => startEdit(null)} className="rounded-xl border px-5 py-3 font-bold">Cancel edit</button> : null}
        </div>
      </form>

      <div className="mt-8 overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-brand-background text-xs font-bold uppercase text-darkText/60">
            <tr><th className="p-3">Vendor</th><th className="p-3">Placement</th><th className="p-3">Start</th><th className="p-3">End</th><th className="p-3">Priority</th><th className="p-3">Status</th><th className="p-3">Sponsored</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td className="p-4" colSpan={8}>Loading…</td></tr> : campaigns.length === 0 ? <tr><td className="p-4 text-darkText/60" colSpan={8}>No promotions yet.</td></tr> : campaigns.map(c => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-bold">{c.vendor.shopName}{c.vendor.status !== "approved" ? <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">{c.vendor.status}</span> : null}</td>
                <td className="p-3">{PLACEMENTS.find(p => p.value === c.placement)?.label || c.placement}</td>
                <td className="p-3 whitespace-nowrap">{new Date(c.startAt).toLocaleString()}</td>
                <td className="p-3 whitespace-nowrap">{c.endAt ? new Date(c.endAt).toLocaleString() : "No end date"}</td>
                <td className="p-3">{c.priority}</td>
                <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(c.status)}`}>{c.status}</span></td>
                <td className="p-3">{c.isSponsored ? "Sponsored" : "Featured Partner"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy} onClick={() => startEdit(c)} className="font-bold text-brand-link underline">Edit</button>
                    {c.status === "ACTIVE" ? <button disabled={busy} onClick={() => void setStatus(c, "DISABLED")} className="font-bold text-amber-700 underline">Disable</button> : <button disabled={busy} onClick={() => void setStatus(c, "ACTIVE")} className="font-bold text-emerald-700 underline">Enable</button>}
                    {c.status !== "ARCHIVED" ? <button disabled={busy} onClick={() => void setStatus(c, "ARCHIVED")} className="font-bold text-darkText/60 underline">Archive</button> : null}
                    <Link href={`/stores/${encodeURIComponent(c.vendor.storeSlug || "")}`} target="_blank" className="font-bold text-darkText/60 underline">Preview</Link>
                    <button disabled={busy} onClick={() => void removeCampaign(c)} className="font-bold text-red-700 underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
