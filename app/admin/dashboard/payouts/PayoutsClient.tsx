"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { formatPKR } from "@/lib/format";

type Row = {
  id: string;
  vendorId: string;
  shopName: string;
  ownerName: string;
  email: string;
  requestedAmount: number;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  notes: string | null;
  status: string;
  rejectionReason: string | null;
  adminNote: string | null;
  requestedAt: string;
  processedAt: string | null;
};

type Stats = {
  pendingRequestCount: number;
  totalRequestedAmountPendingAndApproved: number;
  paidThisMonth: number;
  commissionEarnedThisMonth: number;
};

function badge(s: string) {
  switch (s) {
    case "pending":
      return "bg-amber-100 text-amber-900";
    case "approved":
      return "bg-blue-100 text-blue-800";
    case "paid":
      return "bg-green-100 text-green-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}

export function PayoutsClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectAdminNote, setRejectAdminNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/payouts", { credentials: "same-origin" });
      if (!r.ok) {
        toast.error("Could not load payouts");
        return;
      }
      const d = (await r.json()) as { stats: Stats; withdrawals: Row[] };
      setStats(d.stats);
      setRows(d.withdrawals || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, body: object) {
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/payouts/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        toast.error(data.error || "Action failed");
        return;
      }
      toast.success("Updated");
      void load();
    } finally {
      setBusy(null);
    }
  }

  if (loading && !stats) {
    return <div className="p-8 text-darkText/50">Loading…</div>;
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-darkText">Payouts</h1>
      <p className="mt-1 text-sm text-darkText/60">
        Vendor withdrawal requests and transfer workflow.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Pending requests",
            v: stats?.pendingRequestCount ?? 0,
            fmt: false,
          },
          {
            label: "Total amount requested (pending + approved)",
            v: stats?.totalRequestedAmountPendingAndApproved ?? 0,
            fmt: true,
          },
          {
            label: "Paid this month",
            v: stats?.paidThisMonth ?? 0,
            fmt: true,
          },
          {
            label: "Commission (this month)",
            v: stats?.commissionEarnedThisMonth ?? 0,
            fmt: true,
          },
        ].map((c, i) => (
          <div
            key={i}
            className="rounded-card border border-borderGray bg-white p-4 shadow-card"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-darkText/50">
              {c.label}
            </p>
            <p className="mt-2 text-xl font-bold text-darkText">
              {c.fmt ? formatPKR(Number(c.v)) : c.v}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 overflow-x-auto rounded-card border border-borderGray bg-white shadow-card">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-borderGray bg-lightGray">
            <tr>
              <th className="p-3">Vendor</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Bank</th>
              <th className="p-3">Requested</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-darkText/50">
                  No withdrawal requests yet.
                </td>
              </tr>
            ) : (
              rows.map((w) => (
                <tr
                  key={w.id}
                  className="border-b border-borderGray hover:bg-lightGray/40"
                >
                  <td className="p-3">
                    <p className="font-semibold text-darkText">{w.shopName}</p>
                    <p className="text-xs text-darkText/60">{w.ownerName}</p>
                    <p className="text-xs text-darkText/50">{w.email}</p>
                  </td>
                  <td className="p-3 font-semibold">
                    {formatPKR(w.requestedAmount)}
                  </td>
                  <td className="p-3 text-xs">
                    <div>{w.bankName}</div>
                    <div className="text-darkText/70">{w.accountTitle}</div>
                    <div className="font-mono">{w.accountNumber}</div>
                    {w.notes ? (
                      <div className="mt-1 text-darkText/50">Note: {w.notes}</div>
                    ) : null}
                  </td>
                  <td className="p-3 text-xs text-darkText/70">
                    {new Date(w.requestedAt).toLocaleString("en-PK")}
                    {w.processedAt ? (
                      <div className="mt-1">
                        Processed:{" "}
                        {new Date(w.processedAt).toLocaleString("en-PK")}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${badge(w.status)}`}
                    >
                      {w.status}
                    </span>
                    {w.rejectionReason ? (
                      <p className="mt-1 max-w-[220px] text-xs text-red-700">
                        Vendor: {w.rejectionReason}
                      </p>
                    ) : null}
                    {w.adminNote ? (
                      <p className="mt-1 max-w-[220px] border-l-2 border-darkText/20 pl-2 text-xs text-darkText/50">
                        Internal: {w.adminNote}
                      </p>
                    ) : null}
                  </td>
                  <td className="p-3 space-y-1">
                    {w.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          disabled={busy === w.id}
                          onClick={() => void patch(w.id, { action: "approve" })}
                          className="mr-2 rounded-lg bg-primaryBlue px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy === w.id}
                          onClick={() => setRejectFor(w)}
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    {w.status === "approved" ? (
                      <>
                        <button
                          type="button"
                          disabled={busy === w.id}
                          onClick={() =>
                            void patch(w.id, { action: "mark_paid" })
                          }
                          className="mr-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Mark paid
                        </button>
                        <button
                          type="button"
                          disabled={busy === w.id}
                          onClick={() => setRejectFor(w)}
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rejectFor ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-bold text-darkText">Reject withdrawal</h3>
            <label className="mt-3 block text-sm font-semibold text-darkText">
              Rejection reason{" "}
              <span className="font-normal text-red-700">(vendor will see)</span>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-borderGray p-3 text-sm"
                placeholder="Message shown to the vendor…"
              />
            </label>
            <label className="mt-3 block text-sm font-semibold text-darkText">
              Internal admin note{" "}
              <span className="font-normal text-darkText/50">(optional, admin only)</span>
              <textarea
                value={rejectAdminNote}
                onChange={(e) => setRejectAdminNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-borderGray bg-lightGray/30 p-3 text-sm"
                placeholder="Internal reference — not sent to vendor…"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectFor(null);
                  setRejectReason("");
                  setRejectAdminNote("");
                }}
                className="rounded-xl border border-borderGray px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || busy === rejectFor.id}
                onClick={() => {
                  void patch(rejectFor.id, {
                    action: "reject",
                    rejectionReason: rejectReason.trim(),
                    ...(rejectAdminNote.trim()
                      ? { adminNote: rejectAdminNote.trim() }
                      : {}),
                  }).then(() => {
                    setRejectFor(null);
                    setRejectReason("");
                    setRejectAdminNote("");
                  });
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
