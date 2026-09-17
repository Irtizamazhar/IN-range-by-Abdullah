"use client";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Message = { id: string; senderType: string; body: string; attachmentUrl: string | null; createdAt: string };
type Ticket = { id: string; ticketNumber: string; subject: string; category: string; status: string; priority: string; createdAt: string };

function statusLabel(s: string) { return s.replace(/_/g, " "); }

export function TicketDetail({ apiBase, ticketId }: { apiBase: string; ticketId: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/tickets/${ticketId}`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { setErrorMessage(d.error || "Could not load ticket"); return; }
      setTicket(d.ticket); setMessages(d.messages || []);
    } finally { setLoading(false); }
  }, [apiBase, ticketId]);
  useEffect(() => { void load(); }, [load]);

  async function sendReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const r = await fetch(`${apiBase}/tickets/${ticketId}/messages`, { method: "POST", body: fd, credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not send message");
      setReply(""); (e.target as HTMLFormElement).reset();
      toast.success("Message sent"); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send message"); }
    finally { setBusy(false); }
  }

  async function reopen() {
    setBusy(true);
    try {
      const r = await fetch(`${apiBase}/tickets/${ticketId}/reopen`, { method: "POST", credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not reopen ticket");
      toast.success("Ticket reopened"); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not reopen ticket"); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="mx-auto max-w-3xl px-4 py-8" role="status">Loading…</p>;
  if (!ticket) return <p className="mx-auto max-w-3xl px-4 py-8" role="status">{errorMessage || "Ticket not found."}</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-sm font-bold text-brand-link">{ticket.ticketNumber}</p>
      <h1 className="mt-1 text-2xl font-black text-darkText">{ticket.subject}</h1>
      <p className="mt-1 text-sm text-darkText/60">{ticket.category.replace(/_/g, " ")} · {statusLabel(ticket.status)} · Priority: {ticket.priority}</p>

      <div className="mt-6 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`max-w-[85%] rounded-2xl p-4 ${m.senderType === "ADMIN" ? "bg-brand-background" : "ml-auto bg-brand-primary/20"}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-darkText/50">{m.senderType === "ADMIN" ? "Support" : "Me"}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-darkText">{m.body}</p>
            {m.attachmentUrl ? <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-bold text-brand-link underline">View attachment</a> : null}
            <p className="mt-1 text-[11px] text-darkText/40">{new Date(m.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {ticket.status === "CLOSED" ? (
        <div className="mt-6 rounded-xl border border-borderGray bg-brand-background p-4 text-center">
          <p className="text-sm text-darkText/70">This ticket is closed.</p>
          <button disabled={busy} onClick={() => void reopen()} className="mt-2 rounded-xl bg-brand-primary px-4 py-2 font-bold text-brand-dark disabled:opacity-50">Reopen Ticket</button>
        </div>
      ) : (
        <form onSubmit={e => void sendReply(e)} className="joro-form mt-6 grid gap-3 rounded-2xl border bg-white p-4">
          <label>Reply<textarea name="body" rows={4} maxLength={5000} required value={reply} onChange={e => setReply(e.target.value)} placeholder="Type your message…" /></label>
          <label>Attachment (optional)<input type="file" name="attachment" accept="image/png,image/jpeg,image/webp" /></label>
          <button disabled={busy} className="justify-self-start rounded-xl bg-brand-primary px-5 py-2.5 font-bold text-brand-dark disabled:opacity-50">{busy ? "Sending…" : "Send"}</button>
        </form>
      )}
    </div>
  );
}
