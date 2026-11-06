"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    reason: string;
    suspensionType: "permanent" | "temporary";
    suspensionUntil?: string;
  }) => Promise<void>;
};

export function VendorSuspendModal({ open, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"permanent" | "temporary">("permanent");
  const [until, setUntil] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  // datetime-local has no timezone; these values are always Pakistan time.
  const nowInKarachi = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-black text-darkText">Suspend Vendor</h3>
        <p className="mt-1 text-sm text-darkText/70">
          Provide a reason and suspension type.
        </p>

        <textarea
          className="mt-4 min-h-[110px] w-full rounded-lg border border-borderGray p-3 text-sm"
          placeholder="Suspension reason"
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError(""); }}
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-borderGray p-3 text-sm">
            <input
              type="radio"
              checked={type === "permanent"}
              onChange={() => setType("permanent")}
            />
            Permanent
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-borderGray p-3 text-sm">
            <input
              type="radio"
              checked={type === "temporary"}
              onChange={() => setType("temporary")}
            />
            Temporary
          </label>
        </div>

        {type === "temporary" ? (
          <label className="mt-3 block text-sm font-semibold text-darkText">
            Suspension ends (Pakistan time)
            <input
              type="datetime-local"
              min={nowInKarachi}
              className="mt-1 w-full rounded-lg border border-borderGray px-3 py-2.5 text-sm font-normal"
              value={until}
              onChange={(e) => { setUntil(e.target.value); setError(""); }}
            />
          </label>
        ) : null}

        {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-borderGray px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <LoadingButton loadingLabel="Saving…"
            type="button"

            onClick={async () => {
              if (!reason.trim()) { setError("Enter a suspension reason."); return; }
              if (type === "temporary" && !until) { setError("Choose when the suspension should end."); return; }
              setError("");
              try {
                await onConfirm({
                  reason: reason.trim(),
                  suspensionType: type,
                  suspensionUntil: type === "temporary" ? until : undefined,
                });
                setReason("");
                setType("permanent");
                setUntil("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not suspend this vendor. Please try again.");
              }
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {"Confirm Suspension"}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
