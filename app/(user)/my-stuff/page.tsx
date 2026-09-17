"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { FileText, PackageCheck, RotateCcw, Scale, X } from "lucide-react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatPKR } from "@/lib/format";
import { NeedHelpButton } from "@/components/support/NeedHelpButton";

type StuffItem = { id: string; orderId: string; orderNumber: string; deliveredAt: string; name: string; image: string; variant: string | null; unitPrice: number; quantity: number; returnedQuantity: number; activeReturn: { id: string; quantity: number; status: string } | null; warranty: { id: string; quantity: number; startsAt: string; expiresAt: string; status: string } | null };
type ReturnRow = { id: string; orderId: string; orderNumber: string; productName: string; quantity: number; reason: string; details: string | null; status: string; customerTracking: string | null; vendorNote: string | null; adminNote: string | null; requestedAt: string; refund: { amount: number; status: string; externalRef: string | null } | null };
type DisputeRow = { id: string; orderNumber: string; type: string; message: string; status: string; resolution: string | null; createdAt: string };

const tabs = ["purchases", "returns", "disputes"] as const;

export default function MyStuffPage() {
  const { openAuthModal } = useCustomerAuth(); const search = useSearchParams(); const [errorMessage, setErrorMessage] = useState("");
  const [tab, setTab] = useState<(typeof tabs)[number]>(search?.get("tab") === "returns" ? "returns" : search?.get("tab") === "disputes" ? "disputes" : "purchases");
  const [items, setItems] = useState<StuffItem[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [returnItem, setReturnItem] = useState<StuffItem | null>(null);
  const [disputeOrder, setDisputeOrder] = useState<{ orderId: string; returnRequestId?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErrorMessage("");
    try {
      const [stuffRes, returnsRes, disputesRes] = await Promise.all([
        fetch("/api/customer/my-stuff"),
        fetch("/api/customer/returns"),
        fetch("/api/customer/disputes"),
      ]);
      if ([stuffRes, returnsRes, disputesRes].some((response) => response.status === 401)) {
        setUnauthorized(true);
        return;
      }
      if (!stuffRes.ok || !returnsRes.ok || !disputesRes.ok) throw new Error("Could not load My Stuff");
      const [stuffData, returnsData, disputesData] = await Promise.all([
        stuffRes.json(), returnsRes.json(), disputesRes.json(),
      ]);
      setItems(stuffData.items ?? []);
      setReturns(returnsData.returns ?? []);
      setDisputes(disputesData.disputes ?? []);
      setUnauthorized(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not load My Stuff");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const value = search?.get("tab"); setTab(value === "returns" || value === "disputes" ? value : "purchases"); }, [search]);

  async function requestReturn(event: FormEvent<HTMLFormElement>) {
    try {
    event.preventDefault();
    if (!returnItem) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/customer/returns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderItemId: returnItem.id, quantity: Number(form.get("quantity")), reason: String(form.get("reason") || ""), details: String(form.get("details") || "") }),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.error || "Could not request return");
    toast.success("Return request submitted"); setReturnItem(null); setTab("returns"); await load();
    } catch { toast.error("Could not reach the server. Please try again."); }
  }

  async function addTracking(id: string) {
    try {
    const customerTracking = window.prompt("Enter the courier tracking/reference number");
    if (!customerTracking) return;
    const response = await fetch(`/api/customer/returns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerTracking }) });
    const data = await response.json();
    if (!response.ok) return toast.error(data.error || "Could not save tracking");
    toast.success("Return shipment recorded"); await load();
    } catch { toast.error("Could not reach the server. Please try again."); }
  }

  async function openDispute(event: FormEvent<HTMLFormElement>) {
    try {
    event.preventDefault(); if (!disputeOrder) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/customer/disputes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...disputeOrder, type: String(form.get("type")), message: String(form.get("message")) }) });
    const data = await response.json();
    if (!response.ok) return toast.error(data.error || "Could not open dispute");
    toast.success("Dispute opened for admin review"); setDisputeOrder(null); setTab("disputes"); await load();
    } catch { toast.error("Could not reach the server. Please try again."); }
  }

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-20 text-center text-darkText/55">Loading My Stuff…</main>;
  if (errorMessage) return <main className="mx-auto max-w-xl p-8"><h1 className="text-3xl font-bold">My Stuff</h1><p className="my-4" role="alert">{errorMessage}</p><button className="rounded-xl bg-brand-primary p-3" onClick={() => void load()}>Try again</button></main>;
  if (unauthorized) return <main className="mx-auto max-w-lg px-4 py-20 text-center"><section className="rounded-2xl border border-borderGray bg-white p-8 shadow-card"><h1 className="text-2xl font-black text-brand-dark">Sign in to view My Stuff</h1><p className="mt-2 text-sm text-darkText/60">Purchases, invoices, returns and disputes are private.</p><button onClick={() => openAuthModal("login")} className="mt-6 w-full rounded-xl bg-brand-primary px-4 py-3 font-black text-brand-dark">Sign in</button></section></main>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
      <div><p className="text-sm font-black uppercase tracking-wider text-brand-link">Ownership & after-sales</p><h1 className="text-3xl font-black text-brand-dark">My Stuff</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-darkText/60">Delivered purchases, invoices, returns and disputes in one place.</p></div>
      <div className="mt-7 flex gap-2 overflow-x-auto border-b border-borderGray pb-3">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-xl px-4 py-2.5 text-sm font-bold capitalize ${tab === item ? "bg-brand-primary text-brand-dark" : "bg-white text-darkText/65"}`}>{item}</button>)}</div>

      {tab === "purchases" && <section className="mt-6 grid gap-4 md:grid-cols-2">{items.length ? items.map((item) => { const remaining = item.quantity - item.returnedQuantity; return <article key={item.id} className="flex gap-4 rounded-2xl border border-borderGray bg-white p-4 shadow-card"><div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-lightGray">{item.image ? <Image src={item.image} alt="" fill className="object-cover" sizes="96px" /> : <PackageCheck className="m-8 h-8 w-8 text-darkText/25" />}</div><div className="min-w-0 flex-1"><p className="text-xs font-bold text-brand-link">{item.orderNumber}</p><h2 className="mt-1 line-clamp-2 font-black text-brand-dark">{item.name}</h2><p className="mt-1 text-sm text-darkText/55">Qty {item.quantity} · {formatPKR(item.unitPrice)}</p><p className={`mt-1 text-xs font-semibold ${item.warranty?.status === "active" && new Date(item.warranty.expiresAt) > new Date() ? "text-emerald-700" : "text-darkText/45"}`}>{item.warranty ? `${item.warranty.quantity} item(s) covered until ${new Date(item.warranty.expiresAt).toLocaleDateString("en-PK")}` : "No warranty was specified for this listing"}</p><div className="mt-3 flex flex-wrap gap-2"><Link href={`/invoice/${item.orderId}`} className="inline-flex items-center gap-1 rounded-lg border border-borderGray px-3 py-2 text-xs font-bold text-brand-dark"><FileText className="h-3.5 w-3.5" />Invoice</Link>{remaining > 0 && !item.activeReturn ? <button onClick={() => setReturnItem(item)} className="inline-flex items-center gap-1 rounded-lg bg-brand-soft px-3 py-2 text-xs font-bold text-brand-link"><RotateCcw className="h-3.5 w-3.5" />Return</button> : null}<button onClick={() => setDisputeOrder({ orderId: item.orderId })} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-darkText/65"><Scale className="h-3.5 w-3.5" />Dispute</button></div></div></article>; }) : <Empty title="No delivered purchases" text="Items appear here after delivery is completed." />}</section>}

      {tab === "returns" && <section className="mt-6 space-y-4">{returns.length ? returns.map((row) => <article key={row.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold text-brand-link">{row.orderNumber}</p><h2 className="mt-1 font-black text-brand-dark">{row.productName} × {row.quantity}</h2><p className="mt-2 text-sm text-darkText/60">{row.reason}{row.details ? ` — ${row.details}` : ""}</p></div><div className="flex shrink-0 items-center gap-2"><span className="w-fit rounded-full bg-brand-soft px-3 py-1 text-xs font-bold capitalize text-brand-link">{row.status.replaceAll("_", " ")}</span><NeedHelpButton role="customer" resourceType="RETURN_REQUEST" resourceId={row.id} /></div></div>{row.vendorNote ? <p className="mt-3 rounded-xl bg-lightGray p-3 text-sm text-darkText/65"><strong>Seller:</strong> {row.vendorNote}</p> : null}{row.adminNote ? <p className="mt-3 rounded-xl bg-lightGray p-3 text-sm text-darkText/65"><strong>Admin:</strong> {row.adminNote}</p> : null}<div className="mt-4 flex flex-wrap gap-2">{row.status === "vendor_approved" ? <button onClick={() => void addTracking(row.id)} className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-black text-brand-dark">Add return tracking</button> : null}{["vendor_rejected", "received", "refund_pending"].includes(row.status) ? <button onClick={() => setDisputeOrder({ orderId: row.orderId, returnRequestId: row.id })} className="rounded-lg border border-borderGray px-3 py-2 text-xs font-bold text-brand-dark">Open dispute</button> : null}{row.refund ? <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Refund {formatPKR(row.refund.amount)} · {row.refund.status}</span> : null}</div></article>) : <Empty title="No return requests" text="Eligible delivered items can be returned from the Purchases tab." />}</section>}

      {tab === "disputes" && <section className="mt-6 space-y-4">{disputes.length ? disputes.map((row) => <article key={row.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold text-brand-link">{row.orderNumber} · {row.type}</p><p className="mt-2 text-sm leading-6 text-darkText/70">{row.message}</p></div><span className="h-fit shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold capitalize text-brand-link">{row.status.replaceAll("_", " ")}</span></div>{row.resolution ? <p className="mt-3 rounded-xl bg-lightGray p-3 text-sm text-darkText/70"><strong>Resolution:</strong> {row.resolution}</p> : null}</article>) : <Empty title="No disputes" text="If normal order or return support cannot resolve an issue, open a dispute from a purchase." />}</section>}

      {returnItem ? <Modal title="Request a return" close={() => setReturnItem(null)}><form onSubmit={requestReturn} className="space-y-4"><p className="text-sm text-darkText/65">{returnItem.name} · up to {returnItem.quantity - returnItem.returnedQuantity} item(s)</p><Field label="Quantity"><input name="quantity" type="number" min="1" max={returnItem.quantity - returnItem.returnedQuantity} defaultValue="1" required className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-normal" /></Field><Field label="Reason"><select name="reason" required className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-normal"><option value="">Select reason</option><option>Damaged item</option><option>Wrong item</option><option>Not as described</option><option>Missing parts</option><option>Other</option></select></Field><Field label="Details"><textarea name="details" rows={4} className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-normal" placeholder="Explain the issue clearly" /></Field><button className="w-full rounded-xl bg-brand-primary px-4 py-3 font-black text-brand-dark">Submit return request</button></form></Modal> : null}
      {disputeOrder ? <Modal title="Open a dispute" close={() => setDisputeOrder(null)}><form onSubmit={openDispute} className="space-y-4"><Field label="Issue type"><select name="type" required className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-normal"><option value="order">Order</option><option value="payment">Payment</option><option value="delivery">Delivery</option><option value="return">Return</option><option value="refund">Refund</option><option value="other">Other</option></select></Field><Field label="What happened?"><textarea name="message" minLength={10} maxLength={4000} rows={5} required className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-normal" /></Field><button className="w-full rounded-xl bg-brand-primary px-4 py-3 font-black text-brand-dark">Send to admin review</button></form></Modal> : null}
    </main>
  );
}

function Empty({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-dashed border-borderGray bg-white p-10 text-center md:col-span-2"><h2 className="font-black text-brand-dark">{title}</h2><p className="mt-1 text-sm text-darkText/55">{text}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold text-darkText">{label}{children}</label>; }
function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black text-brand-dark">{title}</h2><button onClick={close} aria-label="Close" className="rounded-lg p-2 hover:bg-lightGray"><X className="h-5 w-5" /></button></div>{children}</div></div>; }
