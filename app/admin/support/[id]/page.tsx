"use client";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Message = { id: string; senderType: string; body: string; isInternalNote: boolean; attachmentUrl: string | null; createdAt: string };
type Ticket = {
  id: string; ticketNumber: string; actorType: string; category: string; subject: string; status: string; priority: string;
  createdAt: string; lastActivityAt: string; assignedTo: { id: string; name: string } | null;
  customer: { name: string; email: string } | null; vendor: { shopName: string; email: string } | null;
};

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "CUSTOMER_REPLIED", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];
const CANNED_REPLIES = [
  "We are reviewing your issue.",
  "Please provide a screenshot.",
  "Your case has been escalated.",
  "Your issue has been resolved.",
];

export default function AdminTicketDetailPage({ params }: { params: { id: string } }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [resource, setResource] = useState<{ id: string; label: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [assignees, setAssignees] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, ar] = await Promise.all([
        fetch(`/api/admin/support/tickets/${params.id}`, { credentials: "same-origin" }),
        fetch(`/api/admin/support/assignees`, { credentials: "same-origin" }),
      ]);
      const td = await tr.json(); const ad = await ar.json();
      if (!tr.ok) { toast.error(td.error || "Could not load ticket"); return; }
      setTicket(td.ticket); setResource(td.resource); setMessages(td.messages || []);
      if (ar.ok) setAssignees(ad.assignees || []);
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  }, [params.id]);
  useEffect(() => { void load(); }, [load]);

  async function sendReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("isInternalNote", isInternalNote ? "true" : "false");
      const r = await fetch(`/api/admin/support/tickets/${params.id}/messages`, { method: "POST", body: fd, credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not send message");
      setReplyBody(""); (e.target as HTMLFormElement).reset();
      toast.success(isInternalNote ? "Internal note added" : "Reply sent"); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send message"); }
    finally { setBusy(false); }
  }

  async function patchTicket(changes: Record<string, unknown>, confirmLabel: string) {
    const reason = window.prompt(`Reason for ${confirmLabel}:`, confirmLabel);
    if (reason === null) return;
    if (reason.trim().length < 3) { toast.error("An audit reason is required."); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/support/tickets/${params.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ ...changes, reason: reason.trim() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not update ticket");
      toast.success("Ticket updated"); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update ticket"); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="p-8" role="status">Loading…</p>;
  if (!ticket) return <p className="p-8" role="status">Ticket not found.</p>;

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <p className="text-sm font-bold text-brand-link">{ticket.ticketNumber}</p>
      <h1 className="mt-1 text-2xl font-black text-darkText">{ticket.subject}</h1>
      <p className="mt-1 text-sm text-darkText/70">
        {ticket.actorType === "CUSTOMER" ? `${ticket.customer?.name} (${ticket.customer?.email})` : `${ticket.vendor?.shopName} (${ticket.vendor?.email})`}
        {" · "}{ticket.category.replace(/_/g, " ")} · {ticket.actorType}
      </p>
      {resource ? <p className="mt-2 rounded-lg bg-brand-background px-3 py-2 text-sm font-bold text-darkText inline-block">Related: {resource.label}</p> : null}

      <div className="mt-5 grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-3">
        <label className="text-sm font-bold text-darkText/70">Status
          <select disabled={busy} value={ticket.status} onChange={e => void patchTicket({ status: e.target.value }, `changing status to ${e.target.value}`)} className="mt-1 block w-full rounded-lg border border-borderGray px-3 py-2 text-sm">
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-darkText/70">Priority
          <select disabled={busy} value={ticket.priority} onChange={e => void patchTicket({ priority: e.target.value }, `setting priority to ${e.target.value}`)} className="mt-1 block w-full rounded-lg border border-borderGray px-3 py-2 text-sm">
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-darkText/70">Assigned To
          <select disabled={busy} value={ticket.assignedTo?.id || ""} onChange={e => void patchTicket({ assignedToId: e.target.value || null }, e.target.value ? "reassigning ticket" : "unassigning ticket")} className="mt-1 block w-full rounded-lg border border-borderGray px-3 py-2 text-sm">
            <option value="">Unassigned</option>
            {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-6 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`max-w-[85%] rounded-2xl p-4 ${m.isInternalNote ? "border-2 border-dashed border-amber-400 bg-amber-50" : m.senderType === "ADMIN" ? "ml-auto bg-brand-primary/20" : "bg-brand-background"}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-darkText/50">{m.isInternalNote ? "Internal Note (staff only)" : m.senderType === "ADMIN" ? "Support (you)" : ticket.actorType === "CUSTOMER" ? ticket.customer?.name || "Customer" : ticket.vendor?.shopName || "Vendor"}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-darkText">{m.body}</p>
            {m.attachmentUrl ? <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-bold text-brand-link underline">View attachment</a> : null}
            <p className="mt-1 text-[11px] text-darkText/40">{new Date(m.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <form onSubmit={e => void sendReply(e)} className="joro-form mt-6 grid gap-3 rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {CANNED_REPLIES.map(t => <button type="button" key={t} onClick={() => setReplyBody(t)} className="rounded-full border border-borderGray px-3 py-1 text-xs font-bold text-darkText hover:bg-brand-soft">{t}</button>)}
        </div>
        <label>{isInternalNote ? "Internal note (staff only — never visible to the customer/vendor)" : "Public reply"}
          <textarea name="body" rows={4} maxLength={5000} required value={replyBody} onChange={e => setReplyBody(e.target.value)} />
        </label>
        <label>Attachment (optional)<input type="file" name="attachment" accept="image/png,image/jpeg,image/webp" /></label>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-darkText"><input type="checkbox" checked={isInternalNote} onChange={e => setIsInternalNote(e.target.checked)} /> Internal note (not sent to customer/vendor)</label>
          <button disabled={busy} className={`rounded-xl px-5 py-2.5 font-bold disabled:opacity-50 ${isInternalNote ? "bg-amber-400 text-amber-950" : "bg-brand-primary text-brand-dark"}`}>{busy ? "Sending…" : isInternalNote ? "Add Internal Note" : "Send Reply"}</button>
        </div>
      </form>
    </div>
  );
}
