"use client";

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
  const [busy, setBusy] = useState(false);

  if (!open) return null;

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
          onChange={(e) => setReason(e.target.value)}
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
          <input
            type="datetime-local"
            className="mt-3 w-full rounded-lg border border-borderGray px-3 py-2.5 text-sm"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-borderGray px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!reason.trim()) return;
              setBusy(true);
              try {
                await onConfirm({
                  reason: reason.trim(),
                  suspensionType: type,
                  suspensionUntil: type === "temporary" && until ? until : undefined,
                });
                setReason("");
                setType("permanent");
                setUntil("");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Saving..." : "Confirm Suspension"}
          </button>
        </div>
      </div>
    </div>
  );
}
