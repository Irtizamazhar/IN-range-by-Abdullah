"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { PartyPopper, X } from "lucide-react";
import { LogoMark } from "@/components/user/LogoMark";

export function FirstCustomerWelcome() {
  const { data: session, status } = useSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || session?.user?.role !== "customer") return;
    const controller = new AbortController();
    fetch("/api/customer/welcome", { cache: "no-store", signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!controller.signal.aborted && data?.showWelcome) setShow(true); })
      .catch(() => {});
    return () => controller.abort();
  }, [status, session?.user?.id, session?.user?.role]);

  useEffect(() => {
    if (show && !dialog.current?.open) dialog.current?.showModal();
    if (!show && dialog.current?.open) dialog.current.close();
  }, [show]);

  async function dismiss() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/customer/welcome", { method: "POST" });
      if (!response.ok) throw new Error("Could not save your choice. Please try again.");
      setShow(false);
    } catch {
      setError("Could not save your choice. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return <dialog ref={dialog} aria-labelledby="joro-welcome-title" aria-describedby="joro-welcome-description" onCancel={event => { event.preventDefault(); void dismiss(); }} className="w-[min(92vw,420px)] rounded-3xl border-0 bg-white p-0 text-[#073c37] shadow-2xl backdrop:bg-[#001d1b]/65">
    <div className="relative overflow-hidden rounded-3xl p-6 text-center sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-lime-100" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-emerald-50" />
      <button type="button" aria-label="Close welcome message" onClick={() => void dismiss()} disabled={saving} className="absolute right-4 top-4 z-10 rounded-full p-2 text-emerald-900 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"><X className="h-5 w-5" /></button>
      <div className="relative mx-auto mb-4 w-fit"><LogoMark href={null} /></div>
      <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-lime-500 text-white shadow-lg motion-safe:animate-pulse"><PartyPopper size={30} aria-hidden /></div>
      <h2 id="joro-welcome-title" className="relative text-2xl font-black tracking-tight sm:text-3xl">Welcome to JORO! 🎉</h2>
      <p id="joro-welcome-description" className="relative mt-3 text-sm leading-6 text-slate-600 sm:text-base">Aapka account ban gaya hai. Ab apni pasand ki shopping shuru karein!</p>
      {error && <p role="alert" className="relative mt-3 text-sm text-red-700">{error}</p>}
      <button type="button" autoFocus disabled={saving} onClick={() => void dismiss()} className="relative mt-6 w-full rounded-xl bg-emerald-800 px-5 py-3 font-bold text-white transition-colors hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:opacity-70">{saving ? "Saving…" : "Let's Start"}</button>
    </div>
  </dialog>;
}
