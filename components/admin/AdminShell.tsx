"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { AdminSidebar } from "@/components/admin/Sidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

const COLLAPSE_KEY = "admin_sidebar_collapsed";

function readCollapsePref(): boolean | null {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw === "1" ? true : raw === "0" ? false : null;
  } catch {
    return null;
  }
}

/**
 * Admin-only chrome. Desktop/tablet: in-flow sidebar that collapses to an icon rail
 * (auto-collapsed below 1024px unless the admin chose otherwise). Mobile (<768px):
 * slide-out drawer with overlay, focus trap and Escape-to-close.
 * The vendor panel keeps using the shared DashboardShell.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsePref, setCollapsePref] = useState<boolean | null>(null);
  const [narrow, setNarrow] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);

  const collapsed = collapsePref ?? narrow;

  useEffect(() => {
    setCollapsePref(readCollapsePref());
    const tablet = window.matchMedia("(max-width: 1023px)");
    const sync = () => setNarrow(tablet.matches);
    sync();
    tablet.addEventListener("change", sync);
    return () => tablet.removeEventListener("change", sync);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsePref(() => {
      const next = !collapsed;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [collapsed]);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // The content pane is the only scroller on dashboard pages; html/body must never add a second scrollbar.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("dashboard-scroll-lock");
    return () => html.classList.remove("dashboard-scroll-lock");
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setDrawerOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
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
      if (event.key === "Escape") { event.preventDefault(); setDrawerOpen(false); }
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
  }, [drawerOpen]);

  return (
    <div className="admin-ui relative flex h-[100dvh] min-h-0 overflow-hidden">
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-admin-dark/60 backdrop-blur-[1px] md:hidden"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <div
        id="admin-sidebar"
        ref={panel}
        role={drawerOpen ? "dialog" : undefined}
        aria-modal={drawerOpen ? true : undefined}
        aria-label="Admin menu"
        className={`${drawerOpen ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 h-[100dvh] w-[17rem] max-w-[85vw] min-h-0 shrink-0 flex-col overflow-hidden bg-admin-dark shadow-2xl md:static md:z-auto md:flex md:max-w-none md:shadow-none md:transition-[width] md:duration-200 ${
          collapsed ? "md:w-[4.75rem]" : "md:w-64"
        }`}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a[href]")) setDrawerOpen(false);
        }}
      >
        {drawerOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute right-2 top-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/85 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-lime md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
        <AdminSidebar collapsed={collapsed && !drawerOpen} />
      </div>
      <div ref={content} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AdminHeader
          menuButtonRef={trigger}
          drawerOpen={drawerOpen}
          onOpenDrawer={() => setDrawerOpen(true)}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        <div className={`relative min-h-0 min-w-0 flex-1 ${drawerOpen ? "overflow-hidden" : "overflow-y-auto"} overflow-x-hidden`}>
          {children}
        </div>
      </div>
    </div>
  );
}
