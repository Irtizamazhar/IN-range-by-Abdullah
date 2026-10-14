"use client";

import { useState } from "react";

export type StatusSlice = { key: string; label: string; count: number; color: string };

const SIZE = 168;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const GAP = 2; // surface gap between segments

/** Order-status donut; legend carries label + count + share so identity never relies on colour. */
export function OrderStatusDonut({ slices }: { slices: StatusSlice[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + x.count, 0);
  const visible = slices.filter((s) => s.count > 0);
  const focus = hover ? slices.find((s) => s.key === hover) : null;

  let offset = 0;
  return (
    <div className="flex min-w-0 flex-col items-center gap-5 sm:flex-row sm:items-center xl:flex-col 2xl:flex-row">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#EEF3EF" strokeWidth={STROKE} />
          {total > 0
            ? visible.map((s) => {
                const len = (s.count / total) * C;
                const dash = visible.length > 1 ? Math.max(0, len - GAP) : len;
                const el = (
                  <circle
                    key={s.key}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={hover === s.key ? STROKE + 4 : STROKE}
                    strokeDasharray={`${dash} ${C - dash}`}
                    strokeDashoffset={-offset}
                    opacity={hover && hover !== s.key ? 0.45 : 1}
                    onPointerEnter={() => setHover(s.key)}
                    onPointerLeave={() => setHover(null)}
                    style={{ transition: "opacity 120ms, stroke-width 120ms" }}
                  />
                );
                offset += len;
                return el;
              })
            : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold text-admin-ink tabular-nums">{focus ? focus.count : total}</span>
          <span className="max-w-[6.5rem] truncate text-xs text-admin-muted">{focus ? focus.label : "Total orders"}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5 text-sm" aria-label="Orders by status">
        {slices.map((s) => {
          const pct = total ? Math.round((s.count / total) * 100) : 0;
          return (
            <li
              key={s.key}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${hover === s.key ? "bg-admin-bg" : ""}`}
              onPointerEnter={() => setHover(s.key)}
              onPointerLeave={() => setHover(null)}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-admin-ink">{s.label}</span>
              <span className="font-semibold text-admin-ink tabular-nums">{s.count}</span>
              <span className="w-10 text-right text-xs text-admin-muted tabular-nums">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
