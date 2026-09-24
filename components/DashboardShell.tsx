"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export function DashboardShell({ sidebar, children, label }: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  label: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const opener = trigger.current;
    document.body.style.overflow = "hidden";
    const main = content.current;
    main?.setAttribute("inert", "");
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex="0"]'
    ) ?? []);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      main?.removeAttribute("inert");
      document.removeEventListener("keydown", onKey);
      opener?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-brand-background md:flex-row">
      <header className="flex h-12 shrink-0 items-center gap-3 bg-footerDark px-4 text-white md:hidden">
        <button ref={trigger} type="button" aria-label={`Open ${label} menu`} aria-expanded={open}
          aria-controls="dashboard-sidebar" onClick={() => setOpen(true)} className="rounded p-1.5 focus-visible:outline focus-visible:outline-2">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">{label}</span>
      </header>
      {open && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" aria-hidden="true" onClick={() => setOpen(false)} />}
      <div id="dashboard-sidebar" ref={panel} role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined} aria-label={`${label} menu`}
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 h-[100dvh] w-64 max-w-[100vw] min-h-0 shrink-0 flex-col overflow-hidden bg-footerDark md:static md:z-auto md:flex`}
        onClick={event => { if ((event.target as HTMLElement).closest("a[href]")) setOpen(false); }}>
        <div className="flex shrink-0 justify-end px-3 py-1 text-white md:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="rounded p-2 focus-visible:outline focus-visible:outline-2">
            <X className="h-5 w-5" />
          </button>
        </div>
        {sidebar}
      </div>
      <div ref={content} className={`min-h-0 min-w-0 flex-1 ${open ? "overflow-hidden" : "overflow-y-auto"}`}>
        {children}
      </div>
    </div>
  );
}
