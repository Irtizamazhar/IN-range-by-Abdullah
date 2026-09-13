"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { RotateCcw, Scale } from "lucide-react";
import { formatPKR } from "@/lib/format";

type ReturnRow = { id: string; orderNumber: string; productName: string; quantity: number; unitPrice: number; reason: string; details: string | null; status: string; customerTracking: string | null; vendorNote: string | null; requestedAt: string; refund: { amount: number; status: string } | null };
type DisputeRow = { id: string; orderNumber: string; type: string; message: string; status: string; resolution: string | null; createdAt: string };

export default function VendorReturnsPage() {
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [tab, setTab] = useState<"returns" | "disputes">("returns");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [returnResponse, disputeResponse] = await Promise.all([
        fetch("/api/vendor/returns", { credentials: "include" }),
        fetch("/api/vendor/disputes", { credentials: "include" }),
      ]);
      if (!returnResponse.ok || !disputeResponse.ok) throw new Error("Could not load after-sales cases");
      const [returnData, disputeData] = await Promise.all([returnResponse.json(), disputeResponse.json()]);
      setReturns(returnData.returns ?? []); setDisputes(disputeData.disputes ?? []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load cases"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(id: string, action: "approve" | "reject" | "received") {
    const note = action === "reject" ? window.prompt("Give the customer a clear rejection reason") : window.prompt("Optional note") || "";
    if (action === "reject" && !note) return;
    const response = await fetch(`/api/vendor/returns/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
    const data = await response.json();
    if (!response.ok) return toast.error(data.error || "Could not update return");
    toast.success("Return updated"); await load();
  }

  return (
    <main className="mx-auto max-w-6xl p-6 md:p-8">
      <div><p className="text-sm font-black uppercase tracking-wider text-brand-link">After-sales</p><h1 className="border-l-4 border-primaryYellow pl-3 text-2xl font-black text-darkText">Returns & disputes</h1><p className="mt-2 text-sm text-darkText/60">Review only cases tied to products from your own store. Refund completion remains admin-controlled.</p></div>
      <div className="mt-6 flex gap-2 border-b border-borderGray pb-3"><button onClick={() => setTab("returns")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${tab === "returns" ? "bg-brand-primary text-brand-dark" : "bg-white"}`}><RotateCcw className="h-4 w-4" />Returns</button><button onClick={() => setTab("disputes")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${tab === "disputes" ? "bg-brand-primary text-brand-dark" : "bg-white"}`}><Scale className="h-4 w-4" />Disputes</button></div>
      {loading ? <p className="py-16 text-center text-darkText/50">Loading cases…</p> : tab === "returns" ? <section className="mt-5 space-y-4">{returns.length ? returns.map((row) => <article key={row.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><p className="text-xs font-bold text-brand-link">{row.orderNumber}</p><h2 className="mt-1 font-black text-brand-dark">{row.productName} × {row.quantity}</h2><p className="mt-2 text-sm text-darkText/65">{row.reason}{row.details ? ` — ${row.details}` : ""}</p><p className="mt-1 text-xs text-darkText/45">Maximum item value: {formatPKR(row.unitPrice * row.quantity)}</p></div><span className="h-fit w-fit rounded-full bg-brand-soft px-3 py-1 text-xs font-bold capitalize text-brand-link">{row.status.replaceAll("_", " ")}</span></div>{row.customerTracking ? <p className="mt-3 rounded-xl bg-lightGray p-3 text-sm"><strong>Customer tracking:</strong> {row.customerTracking}</p> : null}<div className="mt-4 flex gap-2">{row.status === "requested" ? <><button onClick={() => void act(row.id, "approve")} className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-black text-brand-dark">Approve return</button><button onClick={() => void act(row.id, "reject")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Reject with reason</button></> : null}{row.status === "return_in_transit" ? <button onClick={() => void act(row.id, "received")} className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-black text-brand-dark">Confirm item received</button> : null}{row.refund ? <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Refund {formatPKR(row.refund.amount)} · {row.refund.status}</span> : null}</div></article>) : <Empty text="No return requests for your store." />}</section> : <section className="mt-5 space-y-4">{disputes.length ? disputes.map((row) => <article key={row.id} className="rounded-2xl border border-borderGray bg-white p-5 shadow-card"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-brand-link">{row.orderNumber} · {row.type}</p><p className="mt-2 text-sm leading-6 text-darkText/70">{row.message}</p></div><span className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold capitalize text-brand-link">{row.status.replaceAll("_", " ")}</span></div>{row.resolution ? <p className="mt-3 rounded-xl bg-lightGray p-3 text-sm"><strong>Admin resolution:</strong> {row.resolution}</p> : null}</article>) : <Empty text="No disputes linked to your store." />}</section>}
    </main>
  );
}

function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-borderGray bg-white p-10 text-center text-sm text-darkText/55">{text}</div>; }
