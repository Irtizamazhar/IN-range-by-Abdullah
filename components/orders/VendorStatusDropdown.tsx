"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  SHOP_STATUS_FLOW,
  nextShopStatus,
} from "@/lib/vendor-shop-order-helpers";
import type { ShopOrderStatusPill } from "./StatusBadge";

/** Short labels only (no extra Urdu hints — those stay in the help text above). */
function stepLabel(status: ShopOrderStatusPill): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirm order";
    case "packed":
      return "Packed";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    default:
      return status;
  }
}

type Props = {
  currentStatus: ShopOrderStatusPill;
  statusUrl: string;
  onSuccess: () => void;
};

/**
 * Dropdown to move order one step forward. Upcoming steps are visible but disabled
 * so the vendor sees the roadmap; only the immediate next step can be submitted.
 */
export function VendorStatusDropdown({
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

  // Next step in API is always `allowedNext`; tracking applies when moving to shipped.
  const showTracking = allowedNext === "shipped";

  useEffect(() => {
    setSelected("");
    setNote("");
    setTracking("");
  }, [currentStatus]);

  if (!allowedNext) return null;

  const nextIdx = SHOP_STATUS_FLOW.indexOf(allowedNext);
  const currentIdx = nextIdx - 1;

  async function submit() {
    const next = allowedNext;
    if (!selected || selected !== next) {
      toast.error("Dropdown se agla status select karein.");
      return;
    }
    if (
      !window.confirm(
        `Order "${next}" status pe move karna hai?`
      )
    ) {
      return;
    }

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
      if (!r.ok) {
        toast.error(j.error || "Update failed");
        return;
      }
      toast.success("Status update ho gaya");
      onSuccess();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-borderGray bg-lightGray/20 p-4">
      <p className="text-sm font-bold text-darkText">Status update</p>
      <p className="mt-1 text-xs text-darkText/60">
        Neeche se sirf <strong>agla</strong> step select ho sakta hai — skip ya wapas
        nahi.
      </p>

      <label className="mt-4 block text-xs font-bold uppercase text-darkText/50">
        Naya status
      </label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="mt-1 w-full max-w-md rounded-lg border border-borderGray bg-white px-3 py-2.5 text-sm font-medium text-darkText"
      >
        <option value="">Select status</option>
        {SHOP_STATUS_FLOW.map((status, i) => {
          if (i <= currentIdx) return null;
          const isNext = i === currentIdx + 1;
          return (
            <option key={status} value={status} disabled={!isNext}>
              {stepLabel(status as ShopOrderStatusPill)}
            </option>
          );
        })}
      </select>

      <label className="mt-3 block text-xs font-bold uppercase text-darkText/50">
        Note (optional)
      </label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-1 w-full max-w-md rounded-lg border border-borderGray px-3 py-2 text-sm"
        placeholder="Timeline pe note"
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
        {busy ? "Saving…" : "Status update karein"}
      </button>
    </div>
  );
}
