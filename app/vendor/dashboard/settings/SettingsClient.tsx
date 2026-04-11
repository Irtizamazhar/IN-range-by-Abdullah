"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { PAKISTAN_BANK_OPTIONS } from "@/lib/pakistan-banks";

export function SettingsClient() {
  const [bankName, setBankName] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [iban, setIban] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/vendor/bank", { credentials: "include" });
      if (!r.ok) return;
      const d = (await r.json()) as {
        bankName?: string;
        accountTitle?: string;
        accountNumber?: string;
        iban?: string | null;
      };
      setBankName(d.bankName || "");
      setAccountTitle(d.accountTitle || "");
      setAccountNumber(d.accountNumber || "");
      setIban(d.iban || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/vendor/bank", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName,
          accountTitle,
          accountNumber,
          iban: iban.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }
      toast.success("Bank details saved");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-darkText/50">Loading…</div>;
  }

  return (
    <div className="max-w-xl p-6 md:p-8">
      <h1 className="border-l-4 border-primaryYellow pl-3 text-2xl font-bold text-darkText">
        Settings
      </h1>
      <p className="mt-2 text-sm text-darkText/70">
        Payout bank account for withdrawals.
      </p>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Pending withdrawals use the bank details saved at the time you submitted
        the request. Updating here does not change past requests.
      </div>

      <form onSubmit={(e) => void save(e)} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-darkText">
            Bank name
          </label>
          <select
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border border-borderGray bg-white px-3 py-2.5 text-sm"
          >
            <option value="">Select bank</option>
            {bankName &&
            !PAKISTAN_BANK_OPTIONS.includes(
              bankName as (typeof PAKISTAN_BANK_OPTIONS)[number]
            ) ? (
              <option value={bankName}>{bankName}</option>
            ) : null}
            {PAKISTAN_BANK_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-darkText">
            Account title
          </label>
          <input
            required
            value={accountTitle}
            onChange={(e) => setAccountTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-darkText">
            Account number
          </label>
          <input
            required
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-darkText">
            IBAN (optional)
          </label>
          <input
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="PK00…"
            className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5 font-mono text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primaryBlue px-6 py-2.5 font-semibold text-white hover:bg-darkBlue disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save bank details"}
        </button>
      </form>
    </div>
  );
}
