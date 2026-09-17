"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

type Vendor = { id: string; shopName: string; ownerName: string; storeSlug: string | null; status: string };
type TopVendorRow = { id: string; vendorId: string; priority: number; enabled: boolean; label: string | null; vendor: { shopName: string; storeSlug: string | null; status: string } };

function askReason(promptText: string, def = ""): string | null {
  const reason = window.prompt(promptText, def);
  if (reason === null) return null;
  if (reason.trim().length < 3) { toast.error("An audit reason is required."); return null; }
  return reason.trim();
}

export default function TopVendorsPage() {
  const [rows, setRows] = useState<TopVendorRow[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [priorities, setPriorities] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/top-vendors", { credentials: "same-origin" });
      const d = (await r.json()) as { topVendors?: TopVendorRow[]; vendors?: Vendor[]; error?: string };
      if (!r.ok) { toast.error(d.error || "Could not load Top Vendors"); return; }
      setRows(d.topVendors || []); setVendors(d.vendors || []);
      setPriorities(Object.fromEntries((d.topVendors || []).map(row => [row.id, row.priority])));
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filteredVendors = useMemo(() => {
    const q = vendorQuery.trim().toLowerCase();
    if (!q) return vendors.slice(0, 20);
    return vendors.filter(v => v.shopName.toLowerCase().includes(q) || v.ownerName.toLowerCase().includes(q) || (v.storeSlug || "").toLowerCase().includes(q)).slice(0, 20);
  }, [vendors, vendorQuery]);

  async function addVendor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vendorId) { toast.error("Choose an approved vendor from the list first."); return; }
    const f = new FormData(e.currentTarget);
    const reason = String(f.get("reason") || "").trim();
    if (reason.length < 3) { toast.error("An audit reason is required."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/top-vendors", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ vendorId, priority: Number(f.get("priority")) || 0, label: f.get("label"), reason }) });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || "Could not add Top Vendor");
      toast.success("Added to Top Vendors");
      setVendorId(""); setVendorQuery(""); e.currentTarget.reset(); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not add Top Vendor"); }
    finally { setBusy(false); }
  }

  async function savePriority(row: TopVendorRow) {
    const priority = priorities[row.id] ?? row.priority;
    if (priority === row.priority) return;
    const reason = askReason(`Reason for changing "${row.vendor.shopName}"'s priority to ${priority}:`, "Reordering Top Vendors.");
    if (reason === null) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/top-vendors", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id: row.id, priority, reason }) });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || "Could not update priority");
      toast.success("Priority updated"); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update priority"); }
    finally { setBusy(false); }
  }

  async function toggleEnabled(row: TopVendorRow) {
    const next = !row.enabled;
    const reason = askReason(`Reason for ${next ? "enabling" : "disabling"} "${row.vendor.shopName}":`, next ? "Re-enabling Top Vendor." : "Temporarily disabling Top Vendor.");
    if (reason === null) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/top-vendors", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id: row.id, enabled: next, reason }) });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || "Could not update status");
      toast.success(next ? "Enabled" : "Disabled"); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update status"); }
    finally { setBusy(false); }
  }

  async function removeVendor(row: TopVendorRow) {
    const reason = askReason(`Reason for removing "${row.vendor.shopName}" from Top Vendors:`, "No longer a Top Vendor.");
    if (reason === null) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/top-vendors?id=${encodeURIComponent(row.id)}&reason=${encodeURIComponent(reason)}`, { method: "DELETE", credentials: "same-origin" });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || "Could not remove Top Vendor");
      toast.success("Removed from Top Vendors"); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not remove Top Vendor"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <h1 className="text-2xl font-black text-darkText">Top Vendors</h1>
      <p className="mt-1 text-sm text-darkText/70">Admin-curated homepage &quot;Top Vendors&quot; selection. Independent of sponsored promotions — adding a vendor here never makes them sponsored, and sponsoring a vendor never adds them here.</p>

      <form onSubmit={e => void addVendor(e)} className="joro-form relative mt-6 grid gap-4 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Add a vendor to Top Vendors</h2>
        <div className="relative sm:col-span-2">
          <label htmlFor="tvVendorSearch">Approved vendor / store</label>
          <input id="tvVendorSearch" value={vendorQuery} onChange={e => { setVendorQuery(e.target.value); setVendorId(""); }} placeholder="Search by store name, owner, or slug…" autoComplete="off" required={!vendorId} />
          {vendorQuery && !vendorId ? (
            <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border bg-white shadow-lg">
              {filteredVendors.length ? filteredVendors.map(v => (
                <button type="button" key={v.id} onClick={() => { setVendorId(v.id); setVendorQuery(v.shopName); }} className="block w-full border-b px-4 py-2 text-left text-sm last:border-b-0 hover:bg-brand-soft">
                  <span className="font-bold">{v.shopName}</span> <span className="text-darkText/60">· {v.ownerName} · /stores/{v.storeSlug || v.id} · {v.status}</span>
                </button>
              )) : <p className="px-4 py-2 text-sm text-darkText/60">No eligible approved vendor matches (already-added vendors are excluded).</p>}
            </div>
          ) : null}
          {vendorId ? <p className="mt-1 text-xs font-bold text-emerald-700">Selected: {vendorQuery}</p> : null}
        </div>
        <label>Priority (higher shows first)<input name="priority" type="number" defaultValue={0} min={0} max={1000} required /></label>
        <label>Display label (optional)<input name="label" maxLength={60} placeholder="e.g. Community favourite" /></label>
        <label className="sm:col-span-2">Audit reason<input name="reason" minLength={3} placeholder="Why is this vendor being added?" required /></label>
        <button disabled={busy} className="rounded-xl bg-brand-primary px-5 py-3 font-bold text-brand-dark disabled:opacity-50 sm:col-span-2">Add to Top Vendors</button>
      </form>

      <div className="mt-8 overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-brand-background text-xs font-bold uppercase text-darkText/60">
            <tr><th className="p-3">Vendor</th><th className="p-3">Store</th><th className="p-3">Priority</th><th className="p-3">Status</th><th className="p-3">Public/Approved</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td className="p-4" colSpan={6}>Loading…</td></tr> : rows.length === 0 ? <tr><td className="p-4 text-darkText/60" colSpan={6}>No Top Vendors yet.</td></tr> : rows.map(row => (
              <tr key={row.id} className="border-t">
                <td className="p-3 font-bold">{row.vendor.shopName}{row.label ? <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-link">{row.label}</span> : null}</td>
                <td className="p-3">/stores/{row.vendor.storeSlug || row.vendorId}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={1000} value={priorities[row.id] ?? row.priority} onChange={e => setPriorities(p => ({ ...p, [row.id]: Number(e.target.value) }))} className="w-20 rounded-lg border px-2 py-1" />
                    <button disabled={busy} onClick={() => void savePriority(row)} className="font-bold text-brand-link underline">Save</button>
                  </div>
                </td>
                <td className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${row.enabled ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-800"}`}>{row.enabled ? "Enabled" : "Disabled"}</span></td>
                <td className="p-3">{row.vendor.status === "approved" ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">Approved / Public</span> : <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800">Hidden — {row.vendor.status}</span>}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy} onClick={() => void toggleEnabled(row)} className={`font-bold underline ${row.enabled ? "text-amber-700" : "text-emerald-700"}`}>{row.enabled ? "Disable" : "Enable"}</button>
                    <Link href={`/stores/${encodeURIComponent(row.vendor.storeSlug || row.vendorId)}`} target="_blank" className="font-bold text-darkText/60 underline">Open Store</Link>
                    <button disabled={busy} onClick={() => void removeVendor(row)} className="font-bold text-red-700 underline">Remove</button>
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
