"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { LoadingButton } from "@/components/ui/LoadingButton";

type Bank = { bankName: string; accountTitle: string; accountNumber: string; iban: string | null };
type Verification = {
  entered: { name: string; cnic: string | null };
  status: string;
  approval: { approvedAt: string | null; approvedBy: string | null };
  readiness: { canApprove: boolean; blockers: string[]; reviewItems: string[]; titleMatchesName: boolean | null } | null;
  bank: { current: Bank; payout: Bank | null; verificationStatus: string | null; changeRequestedAt: string | null; verifiedAt: string | null };
  audit: { id: string; action: string; createdAt: string; details: unknown }[];
};

const date = (value: string | null) => (value ? new Date(value).toLocaleString("en-PK") : "—");

/**
 * Admin review of one seller: the CNIC number and name to compare with the CNIC images shown in the
 * documents section, approval blockers/review items, and payout bank verification.
 */
export function VendorVerificationPanel({ vendorId, onChanged }: { vendorId: string; onChanged: () => Promise<void> | void }) {
  const [data, setData] = useState<Verification | null>(null);
  const [error, setError] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [bankRejectReason, setBankRejectReason] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/admin/vendors/${encodeURIComponent(vendorId)}/verification`, { cache: "no-store", credentials: "same-origin" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load verification details");
      setData(body as Verification);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load verification details");
    }
  }, [vendorId]);

  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, success: string) {
    const response = await fetch(`/api/admin/vendors/${encodeURIComponent(vendorId)}`, {
      method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(result.error || "Update failed"); await load(); return; }
    toast.success(success);
    await load();
    await onChanged();
  }

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Retry</button></div>;
  if (!data) return <p className="text-sm text-darkText/60">Loading verification…</p>;

  const readiness = data.readiness;
  const needsOverride = Boolean(readiness?.reviewItems.length);
  const bankPending = data.bank.verificationStatus === "pending_review";

  return <div className="space-y-4 rounded-xl border border-borderGray bg-white p-4 text-sm">
    <div>
      <p className="font-bold text-darkText">Identity check</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md bg-neutral-50 p-2"><p className="text-xs text-darkText/50">CNIC number entered</p><p className="font-mono font-semibold">{data.entered.cnic || "—"}</p></div>
        <div className="rounded-md bg-neutral-50 p-2"><p className="text-xs text-darkText/50">Full name entered (as on CNIC)</p><p className="font-semibold">{data.entered.name}</p></div>
      </div>
      <p className="mt-2 text-xs text-darkText/60">Open the CNIC front and back images in the Documents section below and confirm the number and name printed on the card match these details.</p>
    </div>

    <div className="border-t border-borderGray pt-3">
      <p className="font-bold text-darkText">Payout bank details {bankPending ? <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-900">change pending review</span> : null}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div><p className="text-xs text-darkText/50">{bankPending ? "Requested (unverified)" : "Current"}</p><p>{data.bank.current.bankName} · {data.bank.current.accountTitle}</p><p className="font-mono">{data.bank.current.accountNumber}{data.bank.current.iban ? ` · ${data.bank.current.iban}` : ""}</p></div>
        <div><p className="text-xs text-darkText/50">Used for withdrawals</p>{data.bank.payout ? <><p>{data.bank.payout.bankName} · {data.bank.payout.accountTitle}</p><p className="font-mono">{data.bank.payout.accountNumber}</p></> : <p className="text-darkText/60">None verified yet</p>}</div>
      </div>
      {readiness?.titleMatchesName === false && <p className="mt-2 text-xs font-semibold text-amber-800">Account title does not match the CNIC name.</p>}
      {bankPending && data.status === "approved" && <div className="mt-3 flex flex-wrap items-end gap-2">
        <LoadingButton loadingLabel="Verifying…" type="button" onClick={() => act({ action: "verify_bank" }, "Bank details verified")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700">Verify new bank details</LoadingButton>
        <input value={bankRejectReason} onChange={e => setBankRejectReason(e.target.value)} placeholder="Reason to reject the change" maxLength={1000} className="min-w-0 flex-1 rounded-lg border border-borderGray px-3 py-2 text-sm" />
        <LoadingButton loadingLabel="Rejecting…" type="button" disabled={bankRejectReason.trim().length < 5} onClick={() => act({ action: "reject_bank_change", reason: bankRejectReason.trim() }, "Bank change rejected")} className="rounded-lg border border-red-600 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50">Reject change</LoadingButton>
      </div>}
    </div>

    {data.status === "pending" && readiness && <div className="space-y-2 border-t border-borderGray pt-3">
      <p className="font-bold text-darkText">Approval</p>
      {readiness.blockers.length > 0 && <ul className="list-disc space-y-1 pl-5 text-red-800">{readiness.blockers.map(item => <li key={item}>{item}</li>)}</ul>}
      {readiness.reviewItems.length > 0 && <ul className="list-disc space-y-1 pl-5 text-amber-900">{readiness.reviewItems.map(item => <li key={item}>{item}</li>)}</ul>}
      {readiness.canApprove && <>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={reviewConfirmed} onChange={e => setReviewConfirmed(e.target.checked)} />I compared both CNIC images with the CNIC number and name above, and reviewed the bank details.</label>
        {needsOverride && <textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} rows={2} maxLength={1000} placeholder="Override reason (required, at least 15 characters): what you checked manually" className="w-full rounded-lg border border-borderGray p-2 text-sm" />}
        <LoadingButton loadingLabel="Approving…" type="button"
          disabled={!reviewConfirmed || (needsOverride && overrideReason.trim().length < 15)}
          onClick={() => act({ action: "approve", reviewConfirmed: true, ...(needsOverride ? { overrideReason: overrideReason.trim() } : {}) }, "Vendor approved")}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
          {needsOverride ? "Approve with override" : "Approve vendor"}
        </LoadingButton>
      </>}
    </div>}
    {data.approval.approvedAt && <p className="text-xs text-darkText/60">Approved {date(data.approval.approvedAt)} by admin {data.approval.approvedBy}</p>}
  </div>;
}
