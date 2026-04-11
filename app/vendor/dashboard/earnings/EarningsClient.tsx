"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { formatPKR } from "@/lib/format";

type EarningRow = {
  id: string;
  orderNumber: string;
  shopOrderNumber: string | null;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  commissionRate: number;
  status: string;
  createdAt: string;
};

type Summary = {
  totalEarningsNet: number;
  availableBalance: number;
  withdrawnAllTime: number;
  hasOpenWithdrawal: boolean;
};

const MIN_W = 500;

function badgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "paid") return "bg-green-100 text-green-800";
  if (s === "pending") return "bg-amber-100 text-amber-900";
  if (s === "cleared") return "bg-sky-100 text-sky-800";
  return "bg-neutral-100 text-neutral-700";
}

export function EarningsClient({
  focusWithdrawals = false,
}: {
  /** When true (e.g. /vendor/dashboard/withdrawals), scroll to the withdrawal section. */
  focusWithdrawals?: boolean;
}) {
  const withdrawalsRef = useRef<HTMLDivElement | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [pendingWd, setPendingWd] = useState<
    { id: string; requestedAmount: number; status: string; requestedAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bank, setBank] = useState<{
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban?: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [er, bk] = await Promise.all([
        fetch("/api/vendor/earnings", { credentials: "include" }),
        fetch("/api/vendor/bank", { credentials: "include" }),
      ]);
      if (!er.ok) {
        toast.error("Could not load earnings");
        return;
      }
      const data = (await er.json()) as {
        summary: Summary;
        earnings: EarningRow[];
        pendingWithdrawals: typeof pendingWd;
      };
      setSummary(data.summary);
      setEarnings(data.earnings || []);
      setPendingWd(data.pendingWithdrawals || []);
      if (bk.ok) {
        const b = (await bk.json()) as {
          bankName?: string;
          accountTitle?: string;
          accountNumber?: string;
          iban?: string | null;
        };
        if (b.bankName && b.accountTitle && b.accountNumber) {
          setBank({
            bankName: b.bankName,
            accountTitle: b.accountTitle,
            accountNumber: b.accountNumber,
            iban: b.iban?.trim() || null,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusWithdrawals || loading) return;
    const el = withdrawalsRef.current;
    if (!el) return;
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [focusWithdrawals, loading]);

  async function submitWithdrawal() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < MIN_W) {
      toast.error(`Minimum withdrawal is Rs. ${MIN_W}`);
      return;
    }
    if (summary && n > summary.availableBalance + 0.009) {
      toast.error("Amount exceeds available balance");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/vendor/withdrawals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedAmount: n,
          notes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Request failed");
        return;
      }
      toast.success("Withdrawal request submitted");
      setModal(false);
      setAmount("");
      setNotes("");
      void load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !summary) {
    return <div className="p-8 text-darkText/50">Loading…</div>;
  }

  return (
    <div className="max-w-6xl p-6 md:p-8">
      <h1 className="border-l-4 border-primaryYellow pl-3 text-2xl font-bold text-darkText">
        {focusWithdrawals ? "Withdrawals" : "My earnings"}
      </h1>
      <p className="mt-2 text-sm text-darkText/70">
        {focusWithdrawals
          ? "Request payouts and track withdrawal status. Earnings history is below."
          : "Track your net earnings after commission and request withdrawals."}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total earnings (net, all time)",
            value: summary?.totalEarningsNet ?? 0,
          },
          {
            label: "Available balance",
            value: summary?.availableBalance ?? 0,
            highlight: true,
          },
          {
            label: "Withdrawn (all time)",
            value: summary?.withdrawnAllTime ?? 0,
          },
          {
            label: "Open withdrawal?",
            valueText: summary?.hasOpenWithdrawal ? "Yes" : "No",
          },
        ].map((card, i) => (
          <div
            key={i}
            className={`rounded-card border border-borderGray bg-white p-4 shadow-card ${
              card.highlight ? "ring-2 ring-primaryYellow/40" : ""
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-darkText/50">
              {card.label}
            </p>
            <p className="mt-2 text-xl font-bold text-darkText">
              {"valueText" in card
                ? card.valueText
                : formatPKR(Number(card.value))}
            </p>
          </div>
        ))}
      </div>

      <div
        ref={withdrawalsRef}
        id="vendor-withdrawals"
        className="scroll-mt-24"
      >
        {!focusWithdrawals ? (
          <>
            <h2 className="mt-8 text-lg font-bold text-darkText">
              Withdrawals
            </h2>
            <p className="mt-1 text-sm text-darkText/65">
              Request a payout to your saved bank account (manage details in
              Settings).
            </p>
          </>
        ) : null}
        <div
          className={`flex flex-wrap items-center gap-3 ${focusWithdrawals ? "mt-6" : "mt-4"}`}
        >
          <button
            type="button"
            disabled={
              !summary ||
              summary.availableBalance < MIN_W ||
              summary.hasOpenWithdrawal ||
              !bank
            }
            onClick={() => setModal(true)}
            className="rounded-xl bg-primaryBlue px-6 py-2.5 font-semibold text-white disabled:pointer-events-none disabled:opacity-50 hover:bg-darkBlue"
          >
            Request withdrawal
          </button>
          {!bank ? (
            <p className="text-sm text-amber-700">
              Add bank details in Settings before withdrawing.
            </p>
          ) : null}
          {summary && summary.availableBalance < MIN_W ? (
            <p className="text-sm text-darkText/60">
              Minimum withdrawal Rs. {MIN_W}. Available:{" "}
              {formatPKR(summary.availableBalance)}.
            </p>
          ) : null}
        </div>

        {pendingWd.length > 0 ? (
          <div className="mt-6">
            <h3 className="mb-3 text-base font-bold text-darkText">
              Pending withdrawal requests
            </h3>
            <ul className="space-y-2 text-sm">
              {pendingWd.map((w) => (
                <li
                  key={w.id}
                  className="rounded-lg border border-borderGray bg-white px-4 py-2"
                >
                  {formatPKR(w.requestedAmount)} ·{" "}
                  <span className="font-semibold capitalize">{w.status}</span> ·{" "}
                  {new Date(w.requestedAt).toLocaleString("en-PK")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-10 overflow-x-auto rounded-card border border-borderGray bg-white shadow-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-borderGray bg-lightGray">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Seller ref</th>
              <th className="p-3">Gross</th>
              <th className="p-3">Commission</th>
              <th className="p-3">Net</th>
              <th className="p-3">Date</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {earnings.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-darkText/50">
                  No earnings yet. Earnings appear when a shop order is marked
                  delivered.
                </td>
              </tr>
            ) : (
              earnings.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-borderGray hover:bg-lightGray/40"
                >
                  <td className="p-3 font-mono text-xs">{e.orderNumber}</td>
                  <td className="p-3 font-mono text-xs">
                    {e.shopOrderNumber ?? "—"}
                  </td>
                  <td className="p-3">{formatPKR(e.grossAmount)}</td>
                  <td className="p-3">{formatPKR(e.commissionAmount)}</td>
                  <td className="p-3 font-semibold">{formatPKR(e.netAmount)}</td>
                  <td className="p-3 text-darkText/70">
                    {new Date(e.createdAt).toLocaleDateString("en-PK")}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass(e.status)}`}
                    >
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-darkText">Request withdrawal</h3>
            <p className="mt-1 text-sm text-darkText/70">
              Available:{" "}
              <strong>{formatPKR(summary?.availableBalance ?? 0)}</strong>
            </p>
            {bank ? (
              <div className="mt-4 rounded-lg border border-borderGray bg-lightGray/40 p-3 text-sm">
                <p className="font-semibold text-darkText">Payout account</p>
                <p className="mt-1 text-darkText/80">{bank.bankName}</p>
                <p className="text-darkText/80">{bank.accountTitle}</p>
                <p className="font-mono text-darkText/80">{bank.accountNumber}</p>
                {bank.iban ? (
                  <p className="mt-1 font-mono text-xs text-darkText/70">
                    IBAN: {bank.iban}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-amber-800">
                  Pending requests use the bank details saved at request time.
                </p>
              </div>
            ) : null}
            <label className="mt-4 block text-sm font-semibold text-darkText">
              Amount (min Rs. {MIN_W})
              <input
                type="number"
                min={MIN_W}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm font-semibold text-darkText">
              Note (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2"
              />
            </label>
            <div className="mt-6 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-xl border border-borderGray px-4 py-2 font-semibold text-darkText"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitWithdrawal()}
                className="rounded-xl bg-primaryYellow px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
