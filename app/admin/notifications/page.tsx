"use client";
import Link from "@/components/ui/LoadingLink";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import toast from "react-hot-toast";
import { Gift, MessageSquareHeart, ShieldAlert, ShoppingBag, Wallet, Wrench } from "lucide-react";

import { useCallback, useEffect, useState } from "react";
import type { AdminNotification, AdminNotificationKind } from "@/app/api/admin/notifications/route";

const KIND_META: Record<AdminNotificationKind, { label: string; Icon: typeof Gift; tone: string }> = {
  appeal: { label: "Appeal", Icon: ShieldAlert, tone: "bg-red-100 text-red-700" },
  want: { label: "Want", Icon: MessageSquareHeart, tone: "bg-sky-100 text-sky-700" },
  gift: { label: "Gift", Icon: Gift, tone: "bg-pink-100 text-pink-700" },
  service: { label: "Service", Icon: Wrench, tone: "bg-violet-100 text-violet-700" },
  order: { label: "Order", Icon: ShoppingBag, tone: "bg-emerald-100 text-emerald-700" },
  payout: { label: "Payout", Icon: Wallet, tone: "bg-amber-100 text-amber-800" },
};

const FILTERS: Array<{ id: "all" | AdminNotificationKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "order", label: "Orders" },
  { id: "want", label: "Wants" },
  { id: "gift", label: "Gifts" },
  { id: "service", label: "Services" },
  { id: "payout", label: "Payouts" },
  { id: "appeal", label: "Appeals" },
];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminNotificationsPage() {
  const [rows, setRows] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | AdminNotificationKind>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notifications", { credentials: "same-origin" });
      const data = (await res.json()) as { notifications?: AdminNotification[]; error?: string };
      if (!res.ok) {
        setError(data.error || "Failed to load notifications.");
        setRows([]);
        return;
      }
      setRows(data.notifications || []);
    } catch {
      setError("Network error.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAllRead() {
    const response = await fetch("/api/admin/notifications", {
      method: "PATCH",
      credentials: "same-origin",
    });
    if (!response.ok) {
      toast.error("Could not mark notifications as read. Please retry.");
      return;
    }
    await load();
    window.dispatchEvent(new Event("admin-notifications-updated"));
    toast.success("Notifications marked as read");
  }

  const visible = filter === "all" ? rows : rows.filter((n) => n.kind === filter);
  const unread = rows.filter((n) => n.unread).length;

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-darkText">Notifications</h1>
         
        </div>
        {unread > 0 ? (
          <LoadingButton
            type="button"
            loadingLabel="Saving…"
            onClick={() => markAllRead()}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-hover"
          >
            Mark all read ({unread})
          </LoadingButton>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f.id === "all" ? rows.length : rows.filter((n) => n.kind === f.id).length;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-primaryBlue bg-primaryBlue text-white"
                  : "border-borderGray bg-white text-darkText/80 hover:bg-brand-background"
              }`}
            >
              {f.label} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? <PageSkeleton rows={3} /> : null}
      {error ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-6 space-y-3">
          {visible.length === 0 ? (
            <div className="rounded-xl border border-borderGray bg-white p-8 text-center text-darkText/70">
              No notifications yet.
            </div>
          ) : (
            visible.map((n) => {
              const meta = KIND_META[n.kind];
              return (
                <div
                  key={n.id}
                  className={`flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-start ${
                    n.unread ? "border-primaryBlue/40 bg-primaryBlue/5" : "border-borderGray bg-white"
                  }`}
                >
                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}
                    aria-hidden
                  >
                    <meta.Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {n.unread ? (
                        <span className="h-2 w-2 rounded-full bg-red-500" aria-label="Unread" />
                      ) : null}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.tone}`}>
                        {meta.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${
                          n.needsAction ? "bg-red-100 text-red-700" : "bg-gray-100 text-darkText/70"
                        }`}
                      >
                        {n.needsAction ? "Needs action" : n.status}
                      </span>
                      <span className="text-xs text-darkText/60">{formatDate(n.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 break-words text-sm font-bold text-darkText">{n.title}</p>
                    {n.body ? (
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-darkText/75">{n.body}</p>
                    ) : null}
                    {n.attachmentUrl ? (
                      <a
                        href={n.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-primaryBlue hover:underline"
                      >
                        Open payment screenshot
                      </a>
                    ) : null}
                  </div>
                  <Link
                    href={n.href}
                    className="self-start rounded-lg border border-primaryBlue px-3 py-1.5 text-xs font-semibold text-primaryBlue hover:bg-primaryBlue/10"
                  >
                    {n.kind === "appeal" ? "View Risk Profile" : "Open"}
                  </Link>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
