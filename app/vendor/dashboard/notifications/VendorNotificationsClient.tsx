"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Row = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export function VendorNotificationsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/vendor/notifications", {
        credentials: "include",
      });
      if (!r.ok) {
        toast.error("Could not load notifications");
        return;
      }
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
  }, [load]);

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
    <div className="max-w-3xl p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="border-l-4 border-primaryYellow pl-3 text-2xl font-bold text-darkText">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-darkText/70">
            {unread > 0 ? (
              <>
                You have <span className="font-semibold">{unread}</span> unread
                notification{unread === 1 ? "" : "s"}.
              </>
            ) : (
              "You are all caught up."
            )}
          </p>
        </div>
        {unread > 0 ? (
          <LoadingButton
            type="button"
            loadingLabel="Saving…" onClick={() => markAllRead()}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-hover"
          >
            Mark all read
          </LoadingButton>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-card border border-borderGray bg-white shadow-card">
        {loading && rows.length === 0 ? (
          <PageSkeleton label="Loading…" rows={3} />
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-darkText/50">No notifications yet.</p>
        ) : (
          <ul className="divide-y divide-borderGray">
            {rows.map((n) => (
              <li key={n.id}>
                <LoadingButton
                  type="button"
                  loadingLabel="Saving…"
                  onClick={() => {
                    if (!n.isRead) return markRead(n.id);
                  }}
                  className={`w-full px-4 py-4 text-left transition-colors hover:bg-lightGray/50 ${
                    n.isRead ? "bg-white" : "bg-brand-soft/80"
                  }`}
                >
                  <span className="font-semibold text-darkText">{n.title}</span>
                  <p className="mt-1 text-sm text-darkText/75">{n.message}</p>
                  <p className="mt-2 text-xs text-darkText/45">
                    {new Date(n.createdAt).toLocaleString("en-PK")}
                    {!n.isRead ? (
                      <span className="ml-2 font-medium text-primaryBlue">
                        New
                      </span>
                    ) : null}
                  </p>
                </LoadingButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
