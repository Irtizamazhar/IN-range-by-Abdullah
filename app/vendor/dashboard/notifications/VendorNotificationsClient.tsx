"use client";

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="rounded-xl bg-primaryBlue px-4 py-2 text-sm font-semibold text-white hover:bg-darkBlue"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-card border border-borderGray bg-white shadow-card">
        {loading ? (
          <p className="p-8 text-center text-darkText/50">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-darkText/50">No notifications yet.</p>
        ) : (
          <ul className="divide-y divide-borderGray">
            {rows.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.isRead) void markRead(n.id);
                  }}
                  className={`w-full px-4 py-4 text-left transition-colors hover:bg-lightGray/50 ${
                    n.isRead ? "bg-white" : "bg-sky-50/80"
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
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
