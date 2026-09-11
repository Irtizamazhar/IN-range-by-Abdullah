"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  createdAt: string;
  message: string;
  reasonType: string;
  paymentProofUrl: string | null;
  resolved: boolean;
  vendor: {
    id: string;
    shopName: string;
    ownerName: string;
    email: string;
    status: string;
  };
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function reasonLabel(reasonType: string) {
  if (reasonType === "payment_pending") return "Pending payment/dues";
  if (reasonType === "policy_misunderstanding") return "Policy misunderstanding";
  return "General review";
}

export default function AdminNotificationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notifications", { credentials: "same-origin" });
      const data = (await res.json()) as { notifications?: Row[]; error?: string };
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

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8">
      <h1 className="text-2xl font-black text-darkText">Notifications</h1>
      <p className="mt-1 text-sm text-darkText/70">
        Vendor appeals with direct links to risk profiles.
      </p>

      {loading ? <p className="mt-6 text-darkText/60">Loading...</p> : null}
      {error ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-6 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-borderGray bg-white p-8 text-center text-darkText/70">
              No notifications yet.
            </div>
          ) : (
            rows.map((n) => (
              <div
                key={n.id}
                className="rounded-xl border border-borderGray bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-darkText">
                      {n.vendor.shopName} ({n.vendor.ownerName})
                    </p>
                    <p className="text-xs text-darkText/70">{n.vendor.email}</p>
                    <p className="mt-1 text-xs text-darkText/60">{formatDate(n.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        n.resolved
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {n.resolved ? "Resolved" : "Pending"}
                    </span>
                    <a
                      href={`/admin/vendors/${encodeURIComponent(n.vendor.id)}/suspension`}
                      className="rounded-lg border border-primaryBlue px-3 py-1.5 text-xs font-semibold text-primaryBlue hover:bg-primaryBlue/10"
                    >
                      View Risk Profile
                    </a>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-[#F8F9FA] p-3 text-sm text-darkText/85">
                  <p>
                    <span className="font-semibold">Appeal Type:</span>{" "}
                    {reasonLabel(n.reasonType)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    <span className="font-semibold">Message:</span>{" "}
                    {n.message?.trim() || "No message provided."}
                  </p>
                  {n.paymentProofUrl ? (
                    <a
                      href={n.paymentProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-primaryBlue hover:underline"
                    >
                      Open payment screenshot
                    </a>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
