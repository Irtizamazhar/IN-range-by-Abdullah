"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
export default function Notifications() {
  const { isCustomer, openAuthModal } = useCustomerAuth(); const [rows, setRows] = useState<{ id: string; title: string; message: string; href: string; isRead: boolean }[]>([]); const [message, setMessage] = useState("Loading…");
  const load = useCallback(async () => { try { const r = await fetch("/api/account/notifications"); const d = await r.json(); if (!r.ok) throw new Error(d.error); setRows(d.notifications); setMessage(d.notifications.length ? "" : "No notifications yet."); } catch(e) { setMessage(e instanceof Error ? e.message : "Could not load notifications."); } }, []);
  useEffect(() => { if (isCustomer) void load(); }, [isCustomer, load]);
  async function read(id: string) { try { const r = await fetch("/api/account/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); if (!r.ok) throw new Error("Could not mark notification read."); await load(); } catch(e) { setMessage(e instanceof Error ? e.message : "Could not save."); } }
  return <main className="mx-auto max-w-3xl p-6"><h1 className="text-3xl font-bold">Notifications</h1>{!isCustomer ? <button onClick={() => openAuthModal("login")} className="my-4 rounded-xl bg-brand-primary p-3">Sign in</button> : <><p role="status" className="my-4">{message}</p>{rows.map(n => <article key={n.id} className="mb-3 rounded-2xl border bg-white p-5"><Link href={n.href} className="text-lg font-bold">{n.title}</Link><p className="my-2">{n.message}</p>{!n.isRead && <button onClick={() => void read(n.id)} className="text-sm underline">Mark as read</button>}</article>)}</>}</main>;
}