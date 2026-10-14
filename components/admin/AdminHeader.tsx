"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "@/components/ui/LoadingLink";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Bell, ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck } from "lucide-react";
import { ADMIN_NAV_LINKS, activeAdminHref, signOutAdmin } from "@/components/admin/Sidebar";

function sectionLabel(pathname: string | null): string {
  const href = activeAdminHref(pathname);
  return ADMIN_NAV_LINKS.find((link) => link.href === href)?.label ?? "Admin";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function AdminHeader({
  menuButtonRef,
  drawerOpen,
  onOpenDrawer,
  collapsed,
  onToggleCollapsed,
}: {
  menuButtonRef: RefObject<HTMLButtonElement>;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unresolved, setUnresolved] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  const name = session?.user?.name || "Admin";
  const email = session?.user?.email || "";

  // Same source as the Notifications page: unresolved vendor appeals.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/notifications", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { unresolvedCount?: number } | null) => {
        if (cancelled) return;
        const n = Number(data?.unresolvedCount);
        setUnresolved(data && Number.isFinite(n) ? n : null);
      })
      .catch(() => {
        if (!cancelled) setUnresolved(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const iconButton =
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-admin-border bg-white text-admin-ink transition-colors hover:bg-admin-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-primary";
  const menuItem =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-admin-ink hover:bg-admin-bg focus-visible:bg-admin-bg focus-visible:outline-none";

  return (
    <header className="z-20 flex h-16 shrink-0 items-center gap-3 border-b border-admin-border bg-white/95 px-4 backdrop-blur sm:px-6">
      <button
        ref={menuButtonRef}
        type="button"
        aria-label="Open admin menu"
        aria-expanded={drawerOpen}
        aria-controls="admin-sidebar"
        onClick={onOpenDrawer}
        className={`${iconButton} md:hidden`}
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={collapsed}
        aria-controls="admin-sidebar"
        onClick={onToggleCollapsed}
        className={`${iconButton} hidden md:inline-flex`}
      >
        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-muted sm:block">
          JORO Admin
        </p>
        <p className="truncate text-base font-bold text-admin-ink">{sectionLabel(pathname)}</p>
      </div>

      <Link
        href="/admin/notifications"
        className={`${iconButton} relative`}
        aria-label={
          unresolved ? `Notifications, ${unresolved} unresolved` : "Notifications"
        }
        title="Notifications"
      >
        <Bell className="h-5 w-5" strokeWidth={1.9} />
        {unresolved ? (
          <span className="absolute -right-1.5 -top-1.5 min-w-[1.25rem] rounded-full bg-admin-lime px-1 text-center text-[11px] font-bold leading-5 text-admin-dark ring-2 ring-white tabular-nums">
            {unresolved > 99 ? "99+" : unresolved}
          </span>
        ) : null}
      </Link>

      <div ref={menuRef} className="relative">
        <button
          ref={menuButton}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Account menu for ${name}`}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 max-w-[15rem] items-center gap-2.5 rounded-xl border border-admin-border bg-white pl-1 pr-2 text-left transition-colors hover:bg-admin-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-primary"
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-admin-primary text-xs font-bold text-admin-lime">
            {initials(name)}
          </span>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm font-semibold leading-tight text-admin-ink">{name}</span>
            <span className="block truncate text-[11px] leading-tight text-admin-muted">{email || "Administrator"}</span>
          </span>
          <ChevronDown className="hidden h-4 w-4 shrink-0 text-admin-muted sm:block" aria-hidden />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            aria-label="Account"
            className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-60 rounded-xl border border-admin-border bg-white p-1.5 shadow-[0_12px_32px_rgba(0,61,43,0.14)]"
          >
            <div className="border-b border-admin-border px-3 pb-2.5 pt-1.5">
              <p className="truncate text-sm font-semibold text-admin-ink">{name}</p>
              {email ? <p className="truncate text-xs text-admin-muted">{email}</p> : null}
            </div>
            <div className="pt-1.5">
              <Link role="menuitem" href="/admin/settings" className={menuItem}>
                <Settings className="h-4 w-4 text-admin-muted" /> Settings
              </Link>
              <Link role="menuitem" href="/admin/dashboard/team" className={menuItem}>
                <ShieldCheck className="h-4 w-4 text-admin-muted" /> Admin Team
              </Link>
              <LoadingButton
                role="menuitem"
                loadingLabel="Processing…"
                type="button"
                onClick={signOutAdmin}
                className={menuItem}
              >
                <LogOut className="h-4 w-4 text-admin-muted" /> Log out
              </LoadingButton>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
