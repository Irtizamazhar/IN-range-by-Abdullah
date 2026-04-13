"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { nextShopStatus } from "@/lib/vendor-shop-order-helpers";
import type { ShopOrderStatusPill } from "./StatusBadge";
import { safeParseResponseJson } from "@/lib/parse-fetch-json";

function stepLabel(next: ShopOrderStatusPill): string {
  switch (next) {
    case "shipped":
      return "Mark shipped";
    case "delivered":
      return "Mark delivered";
    default:
      return next;
  }
}

type Props = {
  currentStatus: ShopOrderStatusPill;
  statusUrl: string;
  onSuccess: () => void;
};

/** Admin: advance packed→shipped (optional tracking) or shipped→delivered. */
export function AdminShopStatusDropdown({
  currentStatus,
  statusUrl,
  onSuccess,
}: Props) {
  const allowedNext = nextShopStatus(
    currentStatus as Parameters<typeof nextShopStatus>[0]
  );

  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);

  const showTracking = allowedNext === "shipped";

  useEffect(() => {
    setSelected("");
    setNote("");
    setTracking("");
  }, [currentStatus]);

  if (
    !allowedNext ||
    (allowedNext !== "shipped" && allowedNext !== "delivered")
  ) {
    return null;
  }

  async function submit() {
    const next = allowedNext;
    if (!selected || selected !== next) {
      toast.error("Select the next status from the dropdown.");
      return;
    }
    if (!window.confirm(`Move seller order to "${next}"?`)) return;

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
      const { data: j, parseError } = await safeParseResponseJson<{
        error?: string;
      }>(r);
      if (parseError || !r.ok) {
        toast.error(
          j.error ||
            (r.status ? `Update failed (${r.status})` : "Update failed")
        );
        return;
      }
      toast.success("Status updated");
      onSuccess();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-borderGray bg-sky-50/40 p-4">
      <p className="text-sm font-bold text-darkText">Admin — fulfillment</p>
      <p className="mt-1 text-xs text-darkText/60">
        After the seller marks <strong>packed</strong>, you mark{" "}
        <strong>shipped</strong> (optional tracking), then{" "}
        <strong>delivered</strong>.
      </p>

      <label className="mt-4 block text-xs font-bold uppercase text-darkText/50">
        New status
      </label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="mt-1 w-full max-w-md rounded-lg border border-borderGray bg-white px-3 py-2.5 text-sm font-medium text-darkText"
      >
        <option value="">Select status</option>
        <option value={allowedNext}>{stepLabel(allowedNext)}</option>
      </select>

      <label className="mt-3 block text-xs font-bold uppercase text-darkText/50">
        Note (optional)
      </label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-1 w-full max-w-md rounded-lg border border-borderGray px-3 py-2 text-sm"
        placeholder="Internal note"
      />

      {showTracking ? (
        <>
          <label className="mt-3 block text-xs font-bold uppercase text-darkText/50">
            Tracking (optional)
          </label>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            className="mt-1 w-full max-w-md rounded-lg border border-borderGray px-3 py-2 text-sm"
            placeholder="Courier tracking number"
          />
        </>
      ) : null}

      <button
        type="button"
        disabled={busy || !selected}
        onClick={() => void submit()}
        className="mt-4 rounded-xl bg-primaryBlue px-5 py-2.5 text-sm font-bold text-white hover:bg-darkBlue disabled:opacity-50"
      >
        {busy ? "Saving…" : "Update order status"}
      </button>
    </div>
  );
}
