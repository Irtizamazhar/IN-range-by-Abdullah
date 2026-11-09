"use client";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { PAKISTAN_BANK_OPTIONS } from "@/lib/pakistan-banks";
import { accountTitleError } from "@/lib/validation/person-name";
import { ACCOUNT_NUMBER_ERROR, IBAN_ERROR, compactBankValue, isValidPakistanIban, normalizeAccountNumber } from "@/lib/validation/bank";

type Verification = { status: "verified" | "pending_review"; pendingSince: string | null; payoutAccount: { bankName: string; accountNumber: string } | null };
type Field = "bankName" | "accountTitle" | "accountNumber" | "iban" | "currentPassword";

const KNOWN_BANKS = PAKISTAN_BANK_OPTIONS.filter(bank => bank !== "Other") as readonly string[];

export function SettingsClient() {
  const [bankChoice, setBankChoice] = useState("");
  const [otherBank, setOtherBank] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [iban, setIban] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const r = await fetch("/api/vendor/bank", { credentials: "include" });
      if (!r.ok) throw new Error("Could not load bank details. Please retry.");
      const d = (await r.json()) as { bankName?: string; accountTitle?: string; accountNumber?: string; iban?: string | null; verification?: Verification };
      const saved = d.bankName || "";
      setBankChoice(!saved ? "" : KNOWN_BANKS.includes(saved) ? saved : "Other");
      setOtherBank(saved && !KNOWN_BANKS.includes(saved) ? saved : "");
      setAccountTitle(d.accountTitle || "");
      setAccountNumber(d.accountNumber || "");
      setIban(d.iban || "");
      setVerification(d.verification ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load bank details";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function validate(): Partial<Record<Field, string>> {
    const found: Partial<Record<Field, string>> = {};
    const bankName = bankChoice === "Other" ? otherBank.trim() : bankChoice;
    if (!bankName || (bankName.match(new RegExp("\\p{L}", "gu")) || []).length < 2) found.bankName = "Choose or enter your bank's name.";
    const titleError = accountTitleError(accountTitle);
    if (titleError) found.accountTitle = titleError;
    if (!normalizeAccountNumber(accountNumber)) found.accountNumber = ACCOUNT_NUMBER_ERROR;
    if (iban.trim() && !isValidPakistanIban(iban)) found.iban = IBAN_ERROR;
    if (!currentPassword) found.currentPassword = "Enter your current password to change payout details.";
    return found;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/vendor/bank", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: bankChoice === "Other" ? otherBank.trim() : bankChoice,
          accountTitle,
          accountNumber,
          iban: iban.trim() ? compactBankValue(iban) : null,
          currentPassword,
        }),
      });
      const data = (await res.json()) as { error?: string; field?: Field | null; status?: string; unchanged?: boolean };
      if (!res.ok) {
        if (data.field) setErrors({ [data.field]: data.error });
        toast.error(data.error || "Save failed");
        return;
      }
      setCurrentPassword("");
      toast.success(data.unchanged ? "No changes to save" : data.status === "pending_review" ? "Saved. JORO will verify your new details before they are used for withdrawals." : "Bank details saved");
      await load();
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = (field: Field, extra = "") => `mt-1 w-full rounded-xl border px-3 py-2.5 text-sm ${extra} ${errors[field] ? "border-red-500" : "border-borderGray"}`;
  const error = (field: Field) => errors[field] ? <p id={`${field}-error`} className="mt-1 text-xs font-medium text-red-700">{errors[field]}</p> : null;

  if (loading) {
    return <PageSkeleton label="Loading…" rows={3} />;
  }
  if (loadError) return <div className="max-w-xl p-6 md:p-8"><p role="alert" className="text-sm text-red-700">{loadError}</p><LoadingButton onClick={load} className="mt-4 rounded-xl bg-brand-primary px-4 py-2 font-bold">Retry</LoadingButton></div>;

  return (
    <div className="max-w-xl p-6 md:p-8">
      <h1 className="border-l-4 border-primaryYellow pl-3 text-2xl font-bold text-darkText">
        Settings
      </h1>
      <p className="mt-2 text-sm text-darkText/70">
        Payout bank account for withdrawals.
      </p>

      {verification?.status === "pending_review" ? (
        <div role="status" className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Your new bank details are waiting for JORO verification.{" "}
          {verification.payoutAccount
            ? <>Withdrawals continue to use your verified account <strong>{verification.payoutAccount.bankName} {verification.payoutAccount.accountNumber}</strong> until then.</>
            : <>Withdrawals are available once they are verified.</>}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Pending withdrawals use the bank details saved at the time you submitted
        the request. For your security, new details are verified by JORO before
        they receive payouts, and you are notified of every change.
      </div>

      <LoadingForm onSubmit={(e) => save(e)} noValidate className="mt-8 space-y-4">
        <div>
          <label htmlFor="bankName" className="block text-sm font-semibold text-darkText">
            Bank name
          </label>
          <select
            id="bankName"
            value={bankChoice}
            onChange={(e) => setBankChoice(e.target.value)}
            aria-invalid={Boolean(errors.bankName)}
            className={`${fieldClass("bankName")} bg-white`}
          >
            <option value="">Select bank</option>
            {PAKISTAN_BANK_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b === "Other" ? "Other bank" : b}
              </option>
            ))}
          </select>
          {bankChoice === "Other" ? (
            <input
              aria-label="Bank name"
              value={otherBank}
              maxLength={120}
              onChange={(e) => setOtherBank(e.target.value)}
              placeholder="Enter bank name"
              className={fieldClass("bankName")}
            />
          ) : null}
          {error("bankName")}
        </div>
        <div>
          <label htmlFor="accountTitle" className="block text-sm font-semibold text-darkText">
            Account title
          </label>
          <input
            id="accountTitle"
            value={accountTitle}
            maxLength={200}
            onChange={(e) => setAccountTitle(e.target.value)}
            aria-invalid={Boolean(errors.accountTitle)}
            className={fieldClass("accountTitle")}
          />
          <p className="mt-1 text-xs text-darkText/60">Exactly as on your bank account. For individuals this should match your CNIC name.</p>
          {error("accountTitle")}
        </div>
        <div>
          <label htmlFor="accountNumber" className="block text-sm font-semibold text-darkText">
            Account number
          </label>
          <input
            id="accountNumber"
            value={accountNumber}
            inputMode="numeric"
            maxLength={40}
            onChange={(e) => setAccountNumber(e.target.value.replace(/[^\dA-Za-z\s-]/g, ""))}
            aria-invalid={Boolean(errors.accountNumber)}
            className={fieldClass("accountNumber", "font-mono")}
          />
          {error("accountNumber")}
        </div>
        <div>
          <label htmlFor="iban" className="block text-sm font-semibold text-darkText">
            IBAN (optional)
          </label>
          <input
            id="iban"
            value={iban}
            maxLength={34}
            onChange={(e) => setIban(e.target.value.toUpperCase())}
            placeholder="PK36SCBL0000001123456702"
            aria-invalid={Boolean(errors.iban)}
            className={fieldClass("iban", "font-mono")}
          />
          {error("iban")}
        </div>
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-semibold text-darkText">
            Current password
          </label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            maxLength={128}
            onChange={(e) => setCurrentPassword(e.target.value)}
            aria-invalid={Boolean(errors.currentPassword)}
            className={fieldClass("currentPassword")}
          />
          <p className="mt-1 text-xs text-darkText/60">Required to change where your payouts are sent.</p>
          {error("currentPassword")}
        </div>
        <LoadingButton loadingLabel="Saving…"
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-primary px-6 py-2.5 font-semibold text-brand-dark hover:bg-brand-hover disabled:opacity-50"
        >
          {"Save bank details"}
        </LoadingButton>
      </LoadingForm>
    </div>
  );
}
