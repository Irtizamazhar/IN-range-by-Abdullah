"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
};

/** Modal to capture cancellation reason before PATCH /cancel. */
export function CancelModal({
  open,
  title = "Cancel order",
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-card border border-borderGray bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
      >
        <h2
          id="cancel-modal-title"
          className="text-lg font-bold text-darkText"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-darkText/70">
          Please provide a short reason. This is stored on the order timeline.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="mt-4 w-full rounded-lg border border-borderGray px-3 py-2 text-sm"
          placeholder="Reason for cancellation…"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setReason("");
              onClose();
            }}
            className="rounded-lg border border-borderGray px-4 py-2 text-sm font-semibold text-darkText hover:bg-lightGray/40 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => void submit()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Cancelling…" : "Confirm cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
