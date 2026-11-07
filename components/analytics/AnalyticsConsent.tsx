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
  const preferences = useRef<HTMLButtonElement>(null);
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

  function choose(value: "accepted" | "rejected") {
    // Disable immediately, before React rerenders, including withdrawal during script loading.
    updateAnalytics(value, pathname, search);
    if (value === "rejected") clearAnalyticsCookies();
    try { localStorage.setItem(ANALYTICS_CHOICE_KEY, serializeAnalyticsChoice(value)); } catch { /* Remember in this tab only. */ }
    setChoice(value); setOpen(false); preferences.current?.focus();
  }

  if (!enabled || !hydrated) return null;
  const visible = open || (choice === "unknown" && Boolean(analyticsPage(pathname, search)));
  return <>
    <button ref={preferences} type="button" onClick={() => setOpen(v => !v)} aria-expanded={visible} aria-controls="joro-analytics-preferences"
      className="fixed bottom-3 right-3 z-40 rounded-full border border-[#005055] bg-white px-3 py-2 text-xs font-semibold text-[#005055] shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005055]">
      Analytics preferences
    </button>
    {visible && <section id="joro-analytics-preferences" role="region" aria-labelledby="joro-analytics-heading"
      onKeyDown={event => { if (event.key === "Escape" && open) { setOpen(false); preferences.current?.focus(); } }}
      className="fixed bottom-16 left-3 right-3 z-40 max-h-[70dvh] overflow-y-auto rounded-2xl border border-[#005055]/20 bg-white p-4 text-[#005055] shadow-xl sm:left-auto sm:w-[420px] sm:p-5">
      <h2 id="joro-analytics-heading" className="text-base font-bold">Your analytics choice</h2>
      <p className="mt-2 text-sm leading-relaxed">Optional Google Analytics helps us understand visits to public pages. It stays off unless you accept. Shopping and sign-in work either way.</p>
      <p className="mt-2 text-xs leading-relaxed"><a href="/privacy-policy" className="font-semibold underline underline-offset-2">Privacy policy</a>{" · "}<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">Google privacy information</a></p>
      <p className="mt-2 text-xs">{choice === "accepted" ? "Analytics is accepted. Reject below to withdraw consent." : choice === "rejected" ? "Optional analytics is off." : "No optional analytics has been enabled."} Reopen these preferences any time.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button ref={accept} type="button" onClick={() => choose("accepted")} className="rounded-xl border border-[#005055] bg-[#005055] px-3 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005055]">Accept optional analytics</button>
        <button type="button" onClick={() => choose("rejected")} className="rounded-xl border border-[#005055] bg-white px-3 py-3 text-sm font-semibold text-[#005055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005055]">Reject optional analytics</button>
      </div>
    </section>}
  </>;
}
