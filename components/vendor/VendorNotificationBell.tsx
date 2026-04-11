"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

type Row = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export function VendorNotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/vendor/notifications", { credentials: "include" });
      if (!r.ok) return;
      const data = (await r.json()) as {
        unread?: number;
        notifications?: Row[];
      };
      setUnread(Number(data.unread ?? 0));
      setRows(Array.isArray(data.notifications) ? data.notifications : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markRead(id: string) {
    await fetch(`/api/vendor/notifications/${id}`, {
      method: "PATCH",
      credentials: "include",
    });
    void load();
  }

  async function markAllRead() {
    await fetch("/api/vendor/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ markAllRead: true }),
    });
    void load();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        className="relative rounded-lg p-2 text-white/90 hover:bg-white/10"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[80] mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-white/10 bg-footerDark shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/60">
              Notifications
            </span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-primaryYellow hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && rows.length === 0 ? (
              <p className="p-4 text-sm text-white/50">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-white/50">No notifications yet.</p>
            ) : (
              rows.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.isRead) void markRead(n.id);
                  }}
                  className={`block w-full border-b border-white/5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5 ${
                    n.isRead ? "text-white/70" : "bg-white/5 text-white"
                  }`}
                >
                  <span className="font-semibold">{n.title}</span>
                  <p className="mt-0.5 line-clamp-3 text-xs text-white/60">
                    {n.message}
                  </p>
                  <p className="mt-1 text-[10px] text-white/40">
                    {new Date(n.createdAt).toLocaleString("en-PK")}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
