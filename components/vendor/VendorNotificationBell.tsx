"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import toast from "react-hot-toast";

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
      if (!r.ok) throw new Error("Could not load notifications. Please try again.");
      const data = (await r.json()) as {
        unread?: number;
        notifications?: Row[];
      };
      setUnread(Number(data.unread ?? 0));
      setRows(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load notifications");
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
    const response = await fetch(`/api/vendor/notifications/${id}`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Could not mark this notification as read. Please retry.");
    await load();
    toast.success("Notification marked as read");
  }

  async function markAllRead() {
    const response = await fetch("/api/vendor/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ markAllRead: true }),
    });
    if (!response.ok) throw new Error("Could not mark notifications as read. Please retry.");
    await load();
    toast.success("Notifications marked as read");
  }

  return (
    <div className="relative" ref={panelRef}>
      <LoadingButton
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) return load();
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
      </LoadingButton>

      {open ? (
        <div className="absolute right-0 top-full z-[80] mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-white/10 bg-footerDark shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/60">
              Notifications
            </span>
            {unread > 0 ? (
              <LoadingButton
                type="button"
                loadingLabel="Saving…" onClick={() => markAllRead()}
                className="text-xs font-medium text-primaryBlue hover:underline"
              >
                Mark all read
              </LoadingButton>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && rows.length === 0 ? (
              <PageSkeleton label="Loading…" rows={3} />
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-white/50">No notifications yet.</p>
            ) : (
              rows.map((n) => (
                <LoadingButton
                  key={n.id}
                  type="button"
                  loadingLabel="Saving…"
                  onClick={() => {
                    if (!n.isRead) return markRead(n.id);
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
                </LoadingButton>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
