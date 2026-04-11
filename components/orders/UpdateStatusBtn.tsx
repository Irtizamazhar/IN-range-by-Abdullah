"use client";

import { useState } from "react";
import { nextShopStatus } from "@/lib/vendor-shop-order-helpers";
import type { ShopOrderStatusPill } from "./StatusBadge";

/** Human label for the upcoming transition (vendor-facing). */
function actionLabel(next: ShopOrderStatusPill): string {
  switch (next) {
    case "confirmed":
      return "Confirm order";
    case "packed":
      return "Packed";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    default:
      return `Set ${next}`;
  }
}

type Props = {
  currentStatus: ShopOrderStatusPill;
  /** Full URL for PATCH (vendor or admin if you add it later). */
  statusUrl: string;
  onSuccess: () => void;
};

/**
 * Single “next step” control with confirmation dialog.
 * Collects optional note; optional tracking when entering `shipped`.
 */
export function UpdateStatusBtn({
  currentStatus,
  statusUrl,
  onSuccess,
}: Props) {
  const next = nextShopStatus(currentStatus);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);

  if (!next) return null;

  async function confirm() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        note: note.trim() || undefined,
      };
      if (next === "shipped") {
        body.trackingNumber = tracking.trim() || null;
      }
      const r = await fetch(statusUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Update failed");
      setNote("");
      setTracking("");
      setOpen(false);
      onSuccess();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-primaryBlue px-5 py-2.5 text-sm font-bold text-white hover:bg-darkBlue"
      >
        {actionLabel(next)}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-card border border-borderGray bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-darkText">Confirm update</h3>
            <p className="mt-2 text-sm text-darkText/70">
              Move this order to <strong className="capitalize">{next}</strong>
              ?
            </p>
            <label className="mt-4 block text-xs font-bold uppercase text-darkText/50">
              Note (optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-borderGray px-3 py-2 text-sm"
              placeholder="Internal note for timeline"
            />
            {next === "shipped" ? (
              <>
                <label className="mt-3 block text-xs font-bold uppercase text-darkText/50">
                  Tracking (optional)
                </label>
                <input
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-borderGray px-3 py-2 text-sm"
                  placeholder="Courier tracking number"
                />
              </>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-lg border border-borderGray px-4 py-2 text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirm()}
                className="rounded-lg bg-primaryBlue px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
