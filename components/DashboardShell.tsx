"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

export function DashboardShell({ sidebar, topbar, children, label, className = "", collapseKey }: {
  /** A function receives `collapsed` so the rail can switch to its icon-only layout. */
  sidebar: React.ReactNode | ((collapsed: boolean) => React.ReactNode);
  /** Content of the top bar (search, notifications, profile). The mobile menu button is added before it. */
  topbar?: React.ReactNode;
  children: React.ReactNode;
  label: string;
  /** Extra classes on the root, e.g. a scoped theme like `vendor-ui`. */
  className?: string;
  /** localStorage key; when set, desktop gets a button that collapses the sidebar to an icon rail. */
  collapseKey?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsedPref, setCollapsedPref] = useState(false);
  const collapsed = !!collapseKey && collapsedPref && !open;

  useEffect(() => {
    if (!collapseKey) return;
    try { setCollapsedPref(localStorage.getItem(collapseKey) === "1"); } catch { /* storage unavailable */ }
  }, [collapseKey]);

  const toggleCollapsed = useCallback(() => {
    setCollapsedPref((prev) => {
      const next = !prev;
      try { if (collapseKey) localStorage.setItem(collapseKey, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, [collapseKey]);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);
  // The content pane is the only scroller on dashboard pages; html/body must never add a second scrollbar.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("dashboard-scroll-lock");
    return () => html.classList.remove("dashboard-scroll-lock");
  }, []);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
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
    <div className={`relative flex h-[100dvh] min-h-0 overflow-hidden bg-admin-bg ${className}`}>
      {open && <div className="fixed inset-0 z-40 bg-admin-dark/60 backdrop-blur-[1px] lg:hidden" aria-hidden="true" onClick={() => setOpen(false)} />}
      <div id="dashboard-sidebar" ref={panel} role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined} aria-label={`${label} menu`}
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 h-[100dvh] w-[17rem] max-w-[85vw] min-h-0 shrink-0 flex-col overflow-hidden bg-admin-dark shadow-2xl lg:static lg:z-auto lg:flex lg:max-w-none lg:shadow-none lg:transition-[width] lg:duration-200 ${collapsed ? "lg:w-[4.75rem]" : "lg:w-64"}`}
        onClick={event => { if ((event.target as HTMLElement).closest("a[href]")) setOpen(false); }}>
        {open ? (
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-2 top-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/85 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-lime lg:hidden">
            <X className="h-5 w-5" />
          </button>
        ) : null}
        {typeof sidebar === "function" ? sidebar(collapsed) : sidebar}
      </div>
      <div ref={content} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-admin-border bg-white/95 px-3 backdrop-blur sm:gap-3 sm:px-6">
          <button ref={trigger} type="button" aria-label={`Open ${label} menu`} aria-expanded={open}
            aria-controls="dashboard-sidebar" onClick={() => setOpen(true)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-admin-border bg-white text-admin-ink transition-colors hover:bg-admin-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-primary lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          {collapseKey ? (
            <button type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed}
              aria-controls="dashboard-sidebar" onClick={toggleCollapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-admin-border bg-white text-admin-ink transition-colors hover:bg-admin-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-primary lg:inline-flex">
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
          ) : null}
          {topbar}
        </header>
        <div className={`relative min-h-0 min-w-0 flex-1 overflow-x-hidden ${open ? "overflow-y-hidden" : "overflow-y-auto"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
