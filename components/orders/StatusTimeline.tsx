"use client";

import type { ShopStatusHistoryEntry } from "@/lib/vendor-shop-order-helpers";

/** Renders `statusHistory` newest-first or oldest-first (default oldest at top). */
export function StatusTimeline({
  entries,
  newestFirst = false,
}: {
  entries: ShopStatusHistoryEntry[];
  newestFirst?: boolean;
}) {
  const list = newestFirst ? [...entries].reverse() : entries;
  if (list.length === 0) {
    return (
      <p className="text-sm text-darkText/50">No history recorded yet.</p>
    );
  }
  return (
    <ol className="relative border-s border-borderGray ms-3 space-y-4 ps-6">
      {list.map((e, i) => (
        <li key={`${e.updatedAt}-${i}`} className="text-sm">
          <span className="absolute -start-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primaryBlue ring-4 ring-white" />
          <time className="mb-1 block text-xs text-darkText/50">
            {new Date(e.updatedAt).toLocaleString()}
          </time>
          <span className="font-semibold capitalize text-darkText">
            {e.status}
          </span>
          {e.note ? (
            <p className="mt-0.5 text-darkText/80">{e.note}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
