"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import { ArrowUpRight, LoaderCircle, MessageCircle, Minus, Send, X } from "lucide-react";
import styles from "./LiveChat.module.css";

type Message = { id: string; body: string; senderType: string; createdAt: string };
type Conversation = { messages: Message[]; status: string; available: boolean; unreadCount?: number; readThrough?: string };

export function LiveChat() {
  const { data: session } = useSession();
  const customer = session?.user?.role === "customer";
  const [open, setOpen] = useState(false), [conversation, setConversation] = useState<Conversation | null>(null), [loaded, setLoaded] = useState(false);
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [phone, setPhone] = useState(""), [text, setText] = useState("");
  const [error, setError] = useState(""), [connectionError, setConnectionError] = useState(""), [busy, setBusy] = useState(false);
  const [viewport, setViewport] = useState<{ height: number; offset: number; keyboard: boolean } | null>(null);
  const draft = useRef<{ text: string; key: string } | null>(null);
  const button = useRef<HTMLButtonElement>(null), heading = useRef<HTMLHeadingElement>(null), history = useRef<HTMLDivElement>(null);
  const isOpen = useRef(open), hasAccess = useRef(false), sending = useRef(false), stickToBottom = useRef(true);
  isOpen.current = open;

  async function read(signal?: AbortSignal) {
    const response = await fetch("/api/live-chat", { cache: "no-store", signal });
    if (signal?.aborted) return;
    if (response.status === 401) { hasAccess.current = false; setConversation(null); setLoaded(true); return; }
    const row = await response.json() as Conversation & { error?: string };
    if (!response.ok) throw Error(row.error || "Support is temporarily unavailable.");
    hasAccess.current = true;
    setConversation(row); setLoaded(true);
    if (isOpen.current && (row.unreadCount || 0) > 0) {
      const seen = await fetch("/api/live-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", through: row.readThrough }), signal });
      if (seen.ok && !signal?.aborted) setConversation(current => current ? { ...current, unreadCount: 0 } : current);
    }
  }

  useEffect(() => {
    let stale = false, timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      if (!document.hidden) try { await read(controller.signal); if (!stale) setConnectionError(""); }
      catch { if (!stale) setConnectionError("Connection interrupted. Your conversation will reload when we reconnect."); }
      if (!stale && (open || hasAccess.current)) timer = setTimeout(poll, open ? 15000 : 60000);
    }
    void poll();
    if (open) { stickToBottom.current = true; heading.current?.focus(); }
    return () => { stale = true; controller.abort(); clearTimeout(timer); };
  }, [open, session?.user?.id]);

  useEffect(() => {
    if (!open) return;
    const visual = window.visualViewport;
    let baseline = window.innerHeight;
    function measure() {
      const height = visual?.height || window.innerHeight;
      baseline = Math.max(baseline, window.innerHeight, height);
      setViewport({ height, offset: Math.max(0, window.innerHeight - height - (visual?.offsetTop || 0)), keyboard: baseline - height > 120 });
    }
    measure();
    window.addEventListener("resize", measure); visual?.addEventListener("resize", measure); visual?.addEventListener("scroll", measure);
    return () => { window.removeEventListener("resize", measure); visual?.removeEventListener("resize", measure); visual?.removeEventListener("scroll", measure); };
  }, [open]);

  const lastMessage = conversation?.messages.at(-1)?.id;
  useEffect(() => { if (open && stickToBottom.current && history.current) history.current.scrollTop = history.current.scrollHeight; }, [open, lastMessage, conversation?.messages.length]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("joro:chat-panel", { detail: open }));
    return () => { window.dispatchEvent(new CustomEvent("joro:chat-panel", { detail: false })); };
  }, [open]);
  useEffect(() => {
    const closeForPreferences = () => setOpen(false);
    window.addEventListener("joro:open-analytics", closeForPreferences);
    return () => window.removeEventListener("joro:open-analytics", closeForPreferences);
  }, []);

  function close() { setOpen(false); button.current?.focus(); }
  async function retry() {
    setError(""); setConnectionError("");
    try { await read(); } catch { setConnectionError("Support could not reconnect. Please try again."); }
  }
  async function send(action: "start" | "message" | "reopen") {
    if (sending.current || (action === "message" && !text.trim())) return;
    sending.current = true; setBusy(true); setError("");
    try {
      if (!draft.current || draft.current.text !== text) draft.current = { text, key: crypto.randomUUID() };
      const response = await fetch("/api/live-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "start" ? { action, ...(customer ? {} : { name, email, phone }) } : { action, message: text, clientKey: draft.current.key }) });
      const row = await response.json();
      if (!response.ok) throw Error(row.error || "Your message could not be sent. Please try again.");
      if (action === "start") setLoaded(false);
      if (action === "message") { setText(""); draft.current = null; stickToBottom.current = true; }
      await read(); setConnectionError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Support is unavailable. Please try again."); }
    finally { sending.current = false; setBusy(false); }
  }

  const panelStyle = viewport ? { "--chat-visible-height": `${viewport.height}px`, "--chat-keyboard-offset": `${viewport.offset}px` } as CSSProperties : undefined;
  const field = "mt-1 block min-h-11 w-full rounded-xl border border-emerald-950/15 bg-white px-3 text-base text-emerald-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
  return <>
    <button ref={button} data-floating-action="live-chat" type="button" aria-label="Live Chat" title="Chat with JORO" aria-expanded={open} aria-controls="joro-live-chat" onClick={() => setOpen(value => !value)} className={`${styles.launcher} fixed right-3 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-emerald-950 text-white shadow-[0_5px_20px_rgba(0,61,43,0.22)] transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transform-none motion-reduce:transition-none`}>
      <MessageCircle aria-hidden="true" className="h-6 w-6 text-brand-primary" />
      {!open && Boolean(conversation?.unreadCount) && <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-bold text-brand-dark">{Math.min(conversation?.unreadCount || 0, 99)}</span>}
      <span className="sr-only" aria-live="polite">{!open && conversation?.unreadCount ? `${conversation.unreadCount} unread support messages` : ""}</span>
    </button>

    {open && <section id="joro-live-chat" role="dialog" aria-modal="false" aria-labelledby="joro-live-chat-heading" style={panelStyle} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }} className={`${styles.panel} ${viewport?.keyboard ? styles.keyboard : ""} fixed right-3 z-50 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-emerald-950/10 bg-white text-emerald-950 shadow-[0_16px_60px_rgba(0,45,31,0.20)]`}>
      <header className="flex shrink-0 items-center gap-2 bg-emerald-950 px-3 py-2 text-white">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10"><MessageCircle className="h-5 w-5 text-brand-primary" /></span>
        <div className="min-w-0 flex-1"><h2 ref={heading} tabIndex={-1} id="joro-live-chat-heading" className="text-sm font-bold outline-none">Chat with JORO</h2><p className="mt-0.5 text-[11px] text-emerald-100">Private customer support</p></div>
        <button type="button" onClick={close} aria-label="Minimize live chat" title="Minimize" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><Minus aria-hidden="true" className="h-4 w-4" /></button>
        <button type="button" onClick={close} aria-label="Close live chat" title="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><X aria-hidden="true" className="h-4 w-4" /></button>
      </header>
      <p className="shrink-0 border-b border-emerald-100 bg-emerald-50/60 px-4 py-2 text-xs leading-relaxed text-emerald-900">{conversation?.available ? "Support is available. Replies appear here as they arrive." : "Leave a message. Our team will reply here when available."}</p>
      {(error || connectionError) && <div role="alert" className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-800"><p>{error || connectionError}</p>{connectionError && <button type="button" onClick={() => void retry()} className="min-h-11 font-bold underline underline-offset-2">Reconnect</button>}</div>}

      {!loaded ? <div role="status" className="flex min-h-0 flex-1 items-center justify-center gap-2 p-5 text-sm text-emerald-800">{!connectionError && !error ? <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading your conversation…</> : <button type="button" onClick={() => void retry()} className="min-h-11 rounded-xl border border-emerald-200 px-4 font-semibold">Try loading again</button>}</div> : !conversation ? <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <h3 className="text-lg font-bold">Welcome to JORO support</h3><p className="mb-4 mt-1 text-sm leading-relaxed text-neutral-600">Tell us what you need help with. You can return to this conversation in this browser.</p>
        <form className="space-y-3" onSubmit={event => { event.preventDefault(); void send("start"); }}>
          {customer ? <p className="rounded-xl bg-emerald-50 p-3 text-sm">Start a conversation using your signed-in account.</p> : <>
            <label className="block text-xs font-semibold">Name<input required autoComplete="name" maxLength={120} value={name} onChange={event => setName(event.target.value)} className={field} /></label>
            <label className="block text-xs font-semibold">Email<input type="email" required autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className={field} /></label>
            <label className="block text-xs font-semibold">Phone (optional)<input type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={event => setPhone(event.target.value)} className={field} /></label>
          </>}
          <p className="text-[11px] leading-relaxed text-neutral-600">Contact details are shared privately with support. Never send passwords or payment credentials.</p>
          <button disabled={busy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-950 px-3 text-sm font-bold text-white disabled:opacity-60">{busy ? "Starting…" : "Start conversation"}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></button>
        </form>
      </div> : <>
        <div ref={history} role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions" onScroll={() => { const node = history.current; if (node) stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64; }} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#f7faf8] p-4">
          {conversation.messages.length === 0 && <div className="rounded-2xl border border-emerald-100 bg-white p-4"><p className="text-sm font-bold">How can we help?</p><p className="mt-1 text-xs leading-relaxed text-neutral-600">Send your question below. This is your conversation with the JORO support team.</p></div>}
          {conversation.messages.map(message => <article key={message.id} className={`w-fit max-w-[92%] rounded-2xl px-3 py-2.5 ${message.senderType === "ADMIN" ? "mr-auto rounded-tl-sm border border-emerald-100 bg-white" : "ml-auto rounded-tr-sm bg-emerald-100"}`}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">{message.senderType === "ADMIN" ? "JORO support" : "You"}</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{message.body}</p>
            <time dateTime={message.createdAt} className="mt-1.5 block text-right text-[10px] text-emerald-900/75">{new Date(message.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
          </article>)}
        </div>
        {["CLOSED", "RESOLVED"].includes(conversation.status) ? <div className="shrink-0 border-t border-emerald-100 p-3"><button disabled={busy} onClick={() => void send("reopen")} className="min-h-11 w-full rounded-xl border border-emerald-200 text-sm font-semibold disabled:opacity-60">Reopen conversation</button></div> : <form className="shrink-0 border-t border-emerald-100 bg-white p-3" onSubmit={event => { event.preventDefault(); void send("message"); }}>
          <div className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Your message</span><textarea required disabled={busy} maxLength={3000} rows={2} value={text} placeholder="Write your message…" onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send("message"); } }} className="block max-h-28 min-h-11 w-full resize-none rounded-xl border border-emerald-950/15 bg-neutral-50 p-2.5 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60" /></label>
            <button type="submit" aria-label="Send" disabled={busy || !text.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-950 text-white disabled:opacity-40">{busy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Send aria-hidden="true" className="h-4 w-4" />}</button></div>
          <p className="mt-1.5 text-[10px] text-neutral-500">Enter to send · Shift + Enter for a new line</p>
        </form>}
      </>}
    </section>}
  </>;
}
