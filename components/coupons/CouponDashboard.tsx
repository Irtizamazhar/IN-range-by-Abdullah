"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPKR } from "@/lib/format";

type Coupon = { id: string; couponCode: string; ownerType: string; fundingType: string; discountType: "percent" | "fixed"; discountValue: string; minOrderAmount: string; maxDiscount: string | null; startDate: string | null; expiryDate: string | null; productIds: unknown; categories: unknown; collectionIds: unknown; selectedVendorIds: unknown; customerIds: unknown; maxUses: number | null; perCustomerLimit: number | null; budget: string | null; spent: string; usedCount: number; status: string; approvals: unknown; approvedAt: string | null; vendor?: { shopName: string } | null };
type Product = { id: string; name?: string; productName?: string; publishedProductId?: string | null; category: string; vendorPublication?: { vendorId: string } | null };
type Vendor = { id: string; shopName: string };
const values = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const initial = { couponCode: "", discountType: "percent", discountValue: "10", minOrderAmount: "0", maxDiscount: "", startDate: "", expiryDate: "", maxUses: "", perCustomerLimit: "", budget: "", fundingType: "PLATFORM_FUNDED", productIds: [] as string[], categories: [] as string[], collectionIds: [] as string[], selectedVendorIds: [] as string[], customerIds: "" };

export function CouponDashboard({ admin }: { admin: boolean }) {
  const endpoint = admin ? "/api/admin/coupons" : "/api/vendor/coupons";
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [campaigns, setCampaigns] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [collections, setCollections] = useState<Array<{ id: string; name: string; productIds: unknown }>>([]);
  const [collectionName, setCollectionName] = useState("");
  const [collectionProductIds, setCollectionProductIds] = useState<string[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [audit, setAudit] = useState<Array<{ id: string; action: string; entityId: string | null; createdAt: string }>>([]);
  const [affectedOrderEarnings, setAffectedOrderEarnings] = useState<Record<string, number>>({});
  const [repeatUsage, setRepeatUsage] = useState<Array<{ couponId: string; customerId: string; uses: number }>>([]);
  const [platformSpending, setPlatformSpending] = useState<Array<{ couponId: string; gross: number; reversed: number; net: number }>>([]);
  const [form, setForm] = useState(initial);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load coupons.");
    setCoupons(data.coupons || []); setCampaigns(data.campaigns || []); setProducts(data.products || []); setVendors(data.vendors || []); setCollections(data.collections || []); setVendorId(data.vendorId || ""); setAudit(data.audit || []); setAffectedOrderEarnings(data.affectedOrderEarnings || {}); setRepeatUsage(data.repeatUsage || []); setPlatformSpending(data.platformSpending || []);
  }, [endpoint]);
  useEffect(() => { load().catch(e => setMessage(e.message)); }, [load]);
  function setField(key: keyof typeof initial, value: string | string[]) { setForm(previous => ({ ...previous, [key]: value })); }
  function toggle(key: "productIds" | "categories" | "collectionIds" | "selectedVendorIds", value: string) { setForm(previous => ({ ...previous, [key]: previous[key].includes(value) ? previous[key].filter(x => x !== value) : [...previous[key], value] })); }
  function edit(coupon: Coupon) {
    setEditId(coupon.id);
    setForm({ couponCode: coupon.couponCode, discountType: coupon.discountType, discountValue: String(coupon.discountValue), minOrderAmount: String(coupon.minOrderAmount), maxDiscount: coupon.maxDiscount || "", startDate: coupon.startDate ? new Date(coupon.startDate).toISOString().slice(0, 16) : "", expiryDate: coupon.expiryDate ? new Date(coupon.expiryDate).toISOString().slice(0, 16) : "", maxUses: coupon.maxUses == null ? "" : String(coupon.maxUses), perCustomerLimit: coupon.perCustomerLimit == null ? "" : String(coupon.perCustomerLimit), budget: coupon.budget || "", fundingType: coupon.fundingType, productIds: values(coupon.productIds), categories: values(coupon.categories), collectionIds: values(coupon.collectionIds), selectedVendorIds: values(coupon.selectedVendorIds), customerIds: values(coupon.customerIds).join(", ") });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function send(method: string, payload: unknown) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save coupon.");
      await load(); setMessage("Coupon updated successfully.");
      if (method === "POST" || method === "PATCH") { setForm(initial); setEditId(null); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save coupon."); }
    finally { setBusy(false); }
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    void send(editId ? "PATCH" : "POST", { ...form, id: editId || undefined, customerIds: admin ? form.customerIds.split(",").map(x => x.trim()).filter(Boolean) : [], discountValue: Number(form.discountValue), minOrderAmount: Number(form.minOrderAmount), maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null, maxUses: form.maxUses ? Number(form.maxUses) : null, perCustomerLimit: form.perCustomerLimit ? Number(form.perCustomerLimit) : null, budget: form.budget ? Number(form.budget) : null, startDate: form.startDate ? new Date(form.startDate).toISOString() : null, expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : null, fundingType: admin ? form.fundingType : "VENDOR_FUNDED" });
  }
  const categoryOptions = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <div><p className="text-sm font-bold uppercase tracking-wide text-[#005235]">Marketing</p><h1 className="text-3xl font-bold text-[#005235]">Coupons</h1><p className="mt-1 text-sm text-gray-600">Create and manage product discounts and redemption limits.</p></div>
    {message && <p role="status" className="rounded-lg border border-[#B5E637] bg-[#F7F9F6] p-3 text-[#005235]">{message}</p>}
    <form onSubmit={save} className="space-y-5 rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold">{editId ? "Edit coupon" : "Create coupon"}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Code <input value={form.couponCode} onChange={e => setField("couponCode", e.target.value.toUpperCase())} disabled={!!editId} placeholder="Auto generate" className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Discount type <select value={form.discountType} onChange={e => setField("discountType", e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="percent">Percentage</option><option value="fixed">Fixed amount</option></select></label>
        <label className="text-sm">Discount value <input type="number" min="0.01" step="0.01" required value={form.discountValue} onChange={e => setField("discountValue", e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Minimum purchase <input type="number" min="0" step="0.01" value={form.minOrderAmount} onChange={e => setField("minOrderAmount", e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Maximum discount <input type="number" min="0.01" step="0.01" value={form.maxDiscount} onChange={e => setField("maxDiscount", e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Starts <input type="datetime-local" value={form.startDate} onChange={e => setField("startDate", e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Expires <input type="datetime-local" value={form.expiryDate} onChange={e => setField("expiryDate", e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Maximum uses <input type="number" min="1" value={form.maxUses} onChange={e => setField("maxUses", e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Uses per customer <input type="number" min="1" value={form.perCustomerLimit} onChange={e => setField("perCustomerLimit", e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
        {admin && <><label className="text-sm">Funding <select value={form.fundingType} onChange={e => setField("fundingType", e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="PLATFORM_FUNDED">JORO funded</option><option value="VENDOR_FUNDED">Vendor funded</option></select></label><label className="text-sm">Promotional budget <input type="number" min="0.01" step="0.01" value={form.budget} onChange={e => setField("budget", e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label></>}
      </div>
      {admin && <fieldset><legend className="font-semibold">Eligible vendors</legend><p className="text-xs text-gray-600">Any vendor targeted by a campaign must approve it before activation, regardless of funding.</p><div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-y-auto">{vendors.map(v => <label key={v.id} className="rounded-lg border px-2 py-1 text-sm"><input type="checkbox" checked={form.selectedVendorIds.includes(v.id)} onChange={() => toggle("selectedVendorIds", v.id)} className="mr-2" />{v.shopName}</label>)}</div></fieldset>}
      {admin && <fieldset><legend className="font-semibold">Eligible collections</legend><p className="text-xs text-gray-600">Collection products are saved with this coupon. Editing a collection later does not silently change an approved campaign.</p><div className="mt-2 flex flex-wrap gap-2">{collections.map(c => <label key={c.id} className="rounded-lg border px-2 py-1 text-sm"><input type="checkbox" checked={form.collectionIds.includes(c.id)} onChange={() => toggle("collectionIds", c.id)} className="mr-2" />{c.name}</label>)}</div></fieldset>}
      <fieldset><legend className="font-semibold">Eligible products</legend><div className="mt-2 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{products.map(p => { const id = admin ? p.id : p.publishedProductId; return id ? <label key={p.id} className="rounded-lg border p-2 text-sm"><input type="checkbox" checked={form.productIds.includes(id)} onChange={() => toggle("productIds", id)} className="mr-2" />{p.name || p.productName}</label> : null; })}</div></fieldset>
      <fieldset><legend className="font-semibold">Eligible categories</legend><div className="mt-2 flex flex-wrap gap-2">{categoryOptions.map(category => <label key={category} className="rounded-lg border px-2 py-1 text-sm"><input type="checkbox" checked={form.categories.includes(category)} onChange={() => toggle("categories", category)} className="mr-2" />{category}</label>)}</div></fieldset>
      {admin && <label className="block text-sm">Eligible customer IDs (optional, comma separated)<input value={form.customerIds} onChange={e => setField("customerIds", e.target.value)} className="mt-1 w-full rounded-lg border p-2" placeholder="Leave blank for all customers" /></label>}
      <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-[#005235] px-5 py-2 font-semibold text-white disabled:opacity-50">{editId ? "Save changes" : "Create coupon"}</button>{editId && <button type="button" onClick={() => { setEditId(null); setForm(initial); }} className="rounded-lg border px-5 py-2">Cancel edit</button>}</div>
    </form>
    {admin && <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Create product collection</h2><label className="mt-3 block text-sm">Collection name<input value={collectionName} onChange={e => setCollectionName(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><div className="mt-3 grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{products.map(p => <label key={p.id} className="rounded-lg border p-2 text-sm"><input type="checkbox" checked={collectionProductIds.includes(p.id)} onChange={() => setCollectionProductIds(previous => previous.includes(p.id) ? previous.filter(id => id !== p.id) : [...previous, p.id])} className="mr-2" />{p.name}</label>)}</div><button type="button" disabled={busy || !collectionName.trim() || !collectionProductIds.length} onClick={() => { setBusy(true); fetch("/api/admin/coupon-collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: collectionName, productIds: collectionProductIds }) }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not save collection."); setCollectionName(""); setCollectionProductIds([]); await load(); setMessage("Collection created."); }).catch(e => setMessage(e.message)).finally(() => setBusy(false)); }} className="mt-3 rounded-lg bg-[#005235] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Create collection</button></section>}
    <section className="space-y-3"><h2 className="text-xl font-semibold">{admin ? "All coupons" : "Your coupons"}</h2>{coupons.map(c => <article key={c.id} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-[#005235]">{c.couponCode}</h3><p className="text-sm text-gray-600">{c.ownerType === "ADMIN" ? "JORO" : c.vendor?.shopName || "Vendor"} · {c.fundingType.replaceAll("_", " ")} · {c.discountType === "percent" ? `${c.discountValue}%` : formatPKR(Number(c.discountValue))}</p><p className="text-sm">{c.usedCount} uses{c.maxUses ? ` / ${c.maxUses}` : ""} · {formatPKR(Number(c.spent))} discounts · {c.status}</p>{!admin && <p className="text-sm">Affected order earnings: {formatPKR(affectedOrderEarnings[c.id] || 0)}</p>}</div><div className="flex flex-wrap gap-2">{(admin ? c.ownerType === "ADMIN" : true) && <button onClick={() => edit(c)} className="rounded-lg border px-3 py-1 text-sm">Edit</button>}{(admin ? c.ownerType === "ADMIN" : true) && ["active", "paused", "inactive"].map(status => <button key={status} disabled={busy || c.status === status} onClick={() => void send("PUT", { id: c.id, status, reason: "Dashboard status change" })} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40">{status === "active" ? "Activate" : status === "paused" ? "Pause" : "Disable"}</button>)}</div></div></article>)}{!coupons.length && <p className="text-sm text-gray-600">No coupons yet.</p>}</section>
    {!admin && <section className="space-y-3"><h2 className="text-xl font-semibold">Admin campaigns targeting your store</h2>{campaigns.map(c => <article key={c.id} className="rounded-xl border bg-white p-4"><h3 className="font-bold">{c.couponCode}</h3><p className="text-sm">{c.fundingType.replaceAll("_", " ")} · {c.status} · {c.usedCount} uses</p><p className="text-sm">Discount: {c.discountType === "percent" ? `${c.discountValue}%` : formatPKR(Number(c.discountValue))} · Minimum: {formatPKR(Number(c.minOrderAmount))} · Budget: {c.budget ? formatPKR(Number(c.budget)) : "No cap"}</p><p className="text-sm">Targeted products: {values(c.productIds).join(", ") || "Selected categories"}. Review these terms before agreeing to the campaign.</p><div className="mt-2 flex gap-2"><button disabled={busy} onClick={() => void send("PATCH", { action: "approve_campaign", id: c.id })} className="rounded-lg bg-[#005235] px-3 py-1 text-sm text-white">Approve campaign</button><button disabled={busy} onClick={() => void send("PATCH", { action: "reject_campaign", id: c.id })} className="rounded-lg border px-3 py-1 text-sm">Reject</button><span className="text-sm">{values(c.approvals).includes(vendorId) ? "Approved" : "Awaiting approval"}</span></div></article>)}{!campaigns.length && <p className="text-sm text-gray-600">No campaigns targeting your store.</p>}</section>}
    {admin && <section className="rounded-xl border bg-white p-4"><h2 className="text-xl font-semibold">Audit history</h2><ul className="mt-3 space-y-1 text-sm">{audit.map(entry => <li key={entry.id}>{new Date(entry.createdAt).toLocaleString()} · {entry.action} · {entry.entityId}</li>)}</ul></section>}
    {admin && <section className="rounded-xl border bg-white p-4"><h2 className="text-xl font-semibold">JORO-funded spending</h2><ul className="mt-3 space-y-1 text-sm">{platformSpending.filter(row => row.gross > 0).map(row => <li key={row.couponId}>Coupon {row.couponId}: {formatPKR(row.gross)} gross, {formatPKR(row.reversed)} refunded, {formatPKR(row.net)} net</li>)}</ul></section>}
    {admin && <section className="rounded-xl border bg-white p-4"><h2 className="text-xl font-semibold">Repeat usage review</h2><p className="text-sm text-gray-600">Customers with three or more redemptions of the same coupon.</p><ul className="mt-3 space-y-1 text-sm">{repeatUsage.map(row => <li key={`${row.couponId}:${row.customerId}`}>Coupon {row.couponId} · Customer {row.customerId} · {row.uses} uses</li>)}</ul></section>}
  </main>;
}
