"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ANALYTICS_CHOICE_KEY, analyticsPage, readAnalyticsChoice, serializeAnalyticsChoice, type AnalyticsChoice } from "@/lib/analytics-policy";
import { clearAnalyticsCookies, updateAnalytics } from "@/lib/analytics-client";

// Owner must review privacy wording and disable automatic Enhanced Measurement first.
const enabled = process.env.NEXT_PUBLIC_GA4_ENABLED === "true"
  && process.env.NEXT_PUBLIC_GA4_PRIVACY_APPROVED === "true";

export function AnalyticsConsent() {
  const pathname = usePathname() || "";
  const search = useSearchParams()?.toString() || "";
  const [choice, setChoice] = useState<AnalyticsChoice>("unknown");
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const preferences = useRef<HTMLButtonElement | null>(null);
  const accept = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const read = () => { try { return readAnalyticsChoice(localStorage.getItem(ANALYTICS_CHOICE_KEY)); } catch { return "unknown" as const; } };
    setChoice(read()); setHydrated(true);
    function storage(event: StorageEvent) { if (event.key === ANALYTICS_CHOICE_KEY || event.key === null) setChoice(read()); }
    window.addEventListener("storage", storage);
    return () => window.removeEventListener("storage", storage);
  }, []);

  useEffect(() => {
    if (!enabled || !hydrated) return;
    updateAnalytics(choice, pathname, search);
    if (choice !== "accepted") clearAnalyticsCookies();
  }, [choice, hydrated, pathname, search]);

  useEffect(() => { if (open) accept.current?.focus(); }, [open]);
  useEffect(() => {
    function reopen() { preferences.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null; setOpen(true); setChatOpen(false); }
    function chat(event: Event) { setChatOpen(Boolean((event as CustomEvent).detail)); }
    window.addEventListener("joro:open-analytics", reopen);
    window.addEventListener("joro:chat-panel", chat);
    return () => { window.removeEventListener("joro:open-analytics", reopen); window.removeEventListener("joro:chat-panel", chat); };
  }, []);

  function choose(value: "accepted" | "rejected") {
    // Disable immediately, before React rerenders, including withdrawal during script loading.
    updateAnalytics(value, pathname, search);
    if (value === "rejected") clearAnalyticsCookies();
    try { localStorage.setItem(ANALYTICS_CHOICE_KEY, serializeAnalyticsChoice(value)); } catch { /* Remember in this tab only. */ }
    setChoice(value); setOpen(false); preferences.current?.focus();
  }

  if (!enabled || !hydrated) return null;
  const visible = !chatOpen && (open || (choice === "unknown" && Boolean(analyticsPage(pathname, search))));
  return <>
    {visible && <section id="joro-analytics-preferences" role="region" aria-labelledby="joro-analytics-heading"
      onKeyDown={event => { if (event.key === "Escape" && open) { setOpen(false); preferences.current?.focus(); } }}
      className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-3 right-16 z-40 max-h-[50dvh] overflow-y-auto rounded-xl border border-[#005055]/20 bg-white p-3 text-[#005055] shadow-xl sm:bottom-5 sm:right-auto sm:w-[360px]">
      <h2 id="joro-analytics-heading" className="text-sm font-bold">Your analytics choice</h2>
      <p className="mt-1 text-xs leading-relaxed">Optional Google Analytics stays off unless you accept. Shopping and sign-in work either way.</p>
      {!open && <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-xs font-semibold underline">Privacy preferences</button>}
      <p className="mt-2 text-xs leading-relaxed"><a href="/privacy-policy" className="font-semibold underline underline-offset-2">Privacy policy</a>{" · "}<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">Google privacy information</a></p>
      {open && <p className="mt-2 text-xs">{choice === "accepted" ? "Analytics is accepted. Reject below to withdraw consent." : "Optional analytics is off."} Reopen preferences from the footer any time.</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <button ref={accept} type="button" onClick={() => choose("accepted")} className="rounded-xl border border-[#005055] bg-[#005055] px-3 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005055]">Accept optional analytics</button>
        <button type="button" onClick={() => choose("rejected")} className="rounded-xl border border-[#005055] bg-white px-3 py-3 text-sm font-semibold text-[#005055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005055]">Reject optional analytics</button>
      </div>
    </section>}
  </>;
}
