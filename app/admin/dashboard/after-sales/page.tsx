"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { RotateCcw, Scale, X } from "lucide-react";
import { formatPKR } from "@/lib/format";

type ReturnRow = { id: string; orderNumber: string; productName: string; quantity: number; reason: string; details: string | null; status: string; customerTracking: string | null; vendorNote: string | null; adminNote: string | null; shopName: string; maximumRefund: number; customer: { name: string; email: string; phone: string }; refund: { id: string; amount: number; status: string; externalRef: string | null } | null };
type DisputeRow = { id: string; orderNumber: string; type: string; message: string; status: string; resolution: string | null; shopName: string; customer: { name: string; email: string; phone: string } };

export default function AdminAfterSalesPage() {
  const [tab, setTab] = useState<"returns" | "disputes">("returns");
  const [returns, setReturns] = useState<ReturnRow[]>([]); const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ row: ReturnRow; kind: "create" | "process" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [returnResponse, disputeResponse] = await Promise.all([fetch("/api/admin/returns"), fetch("/api/admin/disputes")]);
      if (!returnResponse.ok || !disputeResponse.ok) throw new Error("Could not load after-sales cases");
      const [returnData, disputeData] = await Promise.all([returnResponse.json(), disputeResponse.json()]);
      setReturns(returnData.returns ?? []); setDisputes(disputeData.disputes ?? []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load cases"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submitRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!modal) return;
    const form = new FormData(event.currentTarget);
    const body = modal.kind === "create"
      ? { action: "create_refund", amount: Number(form.get("amount")), note: String(form.get("note") || "") }
      : { action: "process_refund", refundId: modal.row.refund?.id, externalRef: String(form.get("externalRef") || ""), note: String(form.get("note") || ""), restock: form.get("restock") === "on" };
    const response = await fetch(`/api/admin/returns/${modal.row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) return toast.error(data.error || "Could not update refund");
    toast.success(modal.kind === "create" ? "Refund queued for real payment" : "Refund marked processed"); setModal(null); await load();
  }

  async function closeReturn(row: ReturnRow) {
    const note = window.prompt("Why is this return being closed?"); if (!note) return;
    const response = await fetch(`/api/admin/returns/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close", note }) });
    const data = await response.json(); if (!response.ok) return toast.error(data.error || "Could not close return"); toast.success("Return closed"); await load();
  }

  async function reviewReturn(row: ReturnRow, action: "approve_return" | "mark_received" | "reject_return") {
    const note = action === "reject_return" ? window.prompt("Give a clear rejection reason") : window.prompt("Optional admin note") || "";
    if (action === "reject_return" && !note) return;
    const response = await fetch(`/api/admin/returns/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
    const data = await response.json(); if (!response.ok) return toast.error(data.error || "Could not review return"); toast.success("Return updated"); await load();
  }

  async function updateDispute(row: DisputeRow, status: "under_review" | "resolved" | "rejected") {
    const resolution = status === "under_review" ? "" : window.prompt("Record the final resolution (visible to customer and vendor)");
    if (status !== "under_review" && !resolution) return;
    const response = await fetch(`/api/admin/disputes/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, resolution }) });
    const data = await response.json(); if (!response.ok) return toast.error(data.error || "Could not update dispute"); toast.success("Dispute updated"); await load();
  }

  return (
    <main className="p-6 md:p-8"><div><p className="text-sm font-black uppercase tracking-wider text-brand-link">Operations</p><h1 className="text-2xl font-black text-darkText">Returns, refunds & disputes</h1><p className="mt-2 text-sm text-darkText/60">Every refund needs a real external transfer reference. No payment is simulated here.</p></div><div className="mt-6 flex gap-2 border-b border-borderGray pb-3"><button onClick={() => setTab("returns")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${tab === "returns" ? "bg-brand-primary text-brand-dark" : "bg-white"}`}><RotateCcw className="h-4 w-4" />Returns & refunds</button><button onClick={() => setTab("disputes")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${tab === "disputes" ? "bg-brand-primary text-brand-dark" : "bg-white"}`}><Scale className="h-4 w-4" />Disputes</button></div>
      {loading ? <p className="py-16 text-center text-darkText/50">Loading cases…</p> : tab === "returns" ? <section className="mt-5 space-y-4">{returns.length ? returns.map((row) => <article key={row.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex flex-col gap-3 lg:flex-row lg:justify-between"><div><p className="text-xs font-bold text-brand-link">{row.orderNumber} · {row.shopName}</p><h2 className="mt-1 font-black text-brand-dark">{row.productName} × {row.quantity}</h2><p className="mt-1 text-xs text-darkText/50">{row.customer.name} · {row.customer.email} · {row.customer.phone}</p><p className="mt-3 text-sm text-darkText/65">{row.reason}{row.details ? ` — ${row.details}` : ""}</p>{row.customerTracking ? <p className="mt-2 text-sm"><strong>Return tracking:</strong> {row.customerTracking}</p> : null}{row.vendorNote ? <p className="mt-2 text-sm"><strong>Seller note:</strong> {row.vendorNote}</p> : null}</div><span className="h-fit w-fit rounded-full bg-brand-soft px-3 py-1 text-xs font-bold capitalize text-brand-link">{row.status.replaceAll("_", " ")}</span></div><div className="mt-4 flex flex-wrap gap-2">{row.status === "requested" ? <><button onClick={() => void reviewReturn(row, "approve_return")} className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-black text-brand-dark">Approve return</button><button onClick={() => void reviewReturn(row, "reject_return")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Reject</button></> : null}{row.status === "return_in_transit" ? <button onClick={() => void reviewReturn(row, "mark_received")} className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-black text-brand-dark">Mark received</button> : null}{row.status === "received" ? <button onClick={() => setModal({ row, kind: "create" })} className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-black text-brand-dark">Create refund</button> : null}{row.status === "refund_pending" && row.refund ? <button onClick={() => setModal({ row, kind: "process" })} className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-black text-brand-dark">Record completed transfer</button> : null}{!["refund_pending", "refunded", "closed"].includes(row.status) ? <button onClick={() => void closeReturn(row)} className="rounded-lg border border-borderGray px-3 py-2 text-xs font-bold text-darkText/70">Close case</button> : null}{row.refund ? <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{formatPKR(row.refund.amount)} · {row.refund.status}{row.refund.externalRef ? ` · ${row.refund.externalRef}` : ""}</span> : null}</div></article>) : <Empty text="No return cases." />}</section> : <section className="mt-5 space-y-4">{disputes.length ? disputes.map((row) => <article key={row.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><p className="text-xs font-bold text-brand-link">{row.orderNumber} · {row.shopName} · {row.type}</p><h2 className="mt-1 font-black text-brand-dark">{row.customer.name}</h2><p className="mt-3 text-sm leading-6 text-darkText/70">{row.message}</p>{row.resolution ? <p className="mt-3 rounded-xl bg-lightGray p-3 text-sm"><strong>Resolution:</strong> {row.resolution}</p> : null}</div><span className="h-fit w-fit rounded-full bg-brand-soft px-3 py-1 text-xs font-bold capitalize text-brand-link">{row.status.replaceAll("_", " ")}</span></div>{!["resolved", "rejected"].includes(row.status) ? <div className="mt-4 flex gap-2">{row.status === "open" ? <button onClick={() => void updateDispute(row, "under_review")} className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-black text-brand-dark">Start review</button> : null}<button onClick={() => void updateDispute(row, "resolved")} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700">Resolve</button><button onClick={() => void updateDispute(row, "rejected")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Reject</button></div> : null}</article>) : <Empty text="No disputes." />}</section>}
      {modal ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><form onSubmit={submitRefund} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-black text-brand-dark">{modal.kind === "create" ? "Create refund record" : "Confirm real refund transfer"}</h2><button type="button" onClick={() => setModal(null)} aria-label="Close"><X className="h-5 w-5" /></button></div><p className="mt-2 text-sm text-darkText/60">{modal.row.orderNumber} · {modal.row.productName}</p>{modal.kind === "create" ? <label className="mt-5 block text-sm font-bold">Amount (maximum {formatPKR(modal.row.maximumRefund)})<input name="amount" type="number" min="0.01" max={modal.row.maximumRefund} step="0.01" defaultValue={modal.row.maximumRefund} required className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-normal" /></label> : <><label className="mt-5 block text-sm font-bold">Bank/provider transfer reference<input name="externalRef" minLength={3} maxLength={191} required className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-normal" /></label><label className="mt-4 flex items-start gap-2 text-sm text-darkText/70"><input type="checkbox" name="restock" className="mt-1" /><span>Return this quantity to sellable inventory. Leave unchecked if damaged or not resellable.</span></label></>}<label className="mt-4 block text-sm font-bold">Admin note<textarea name="note" rows={3} className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-normal" /></label><button className="mt-5 w-full rounded-xl bg-brand-primary px-4 py-3 font-black text-brand-dark">{modal.kind === "create" ? "Queue refund" : "Mark transfer processed"}</button></form></div> : null}
    </main>
  );
}

function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-borderGray bg-white p-10 text-center text-sm text-darkText/55">{text}</div>; }
