"use client";

import { useEffect, useRef, useState } from "react";
import { formatPKR } from "@/lib/format";

export type SalesPoint = { label: string; fullLabel: string; value: number; orders: number };

const HEIGHT = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 56 };

function compactPKR(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(n % 10_000_000 ? 1 : 0)}Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(n % 100_000 ? 1 : 0)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K`;
  return String(Math.round(n));
}

function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag >= v) ?? 10;
  return step * mag;
}

/** Single-series area chart of sales over time; crosshair tooltip on hover/focus. */
export function SalesOverviewChart({ points }: { points: SalesPoint[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = n ? `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : "";

  // Show at most ~1 label per 64px so axis labels never collide.
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 64))));

  function onMove(clientX: number) {
    const el = wrap.current;
    if (!el || !n) return;
    const rel = clientX - el.getBoundingClientRect().left - PAD.left;
    const i = n <= 1 ? 0 : Math.round((rel / innerW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  const active = hover != null ? points[hover] : null;
  const tipLeft = hover != null ? Math.min(Math.max(x(hover), 90), Math.max(90, width - 90)) : 0;

  return (
    <div
      ref={wrap}
      className="relative w-full min-w-0 select-none outline-none"
      style={{ height: HEIGHT }}
      onPointerMove={(e) => onMove(e.clientX)}
      onPointerLeave={() => setHover(null)}
      tabIndex={0}
      role="img"
      aria-label={`Sales overview: ${points
        .map((p) => `${p.fullLabel} ${formatPKR(p.value)}`)
        .join("; ")}`}
      onKeyDown={(e) => {
        if (!n) return;
        if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
        if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
        if (e.key === "Escape") setHover(null);
      }}
      onBlur={() => setHover(null)}
    >
      {width > 0 ? (
        <svg width={width} height={HEIGHT} className="block" aria-hidden>
          <defs>
            <linearGradient id="admin-sales-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#005235" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#005235" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#E3EAE4" strokeDasharray={t ? "3 4" : undefined} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#5E7268">
                {compactPKR(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={p.fullLabel} x={x(i)} y={HEIGHT - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="11" fill="#5E7268">
                {p.label}
              </text>
            ) : null
          )}
          {n ? <path d={area} fill="url(#admin-sales-fill)" /> : null}
          {n ? <path d={line} fill="none" stroke="#005235" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {hover != null ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#003D2B" strokeOpacity={0.35} />
              <circle cx={x(hover)} cy={y(points[hover].value)} r={5} fill="#B5E637" stroke="#003D2B" strokeWidth={2} />
            </g>
          ) : null}
        </svg>
      ) : null}
      {active ? (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-admin-border bg-white px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,61,43,0.14)]"
          style={{ left: tipLeft }}
        >
          <p className="font-semibold text-admin-ink">{active.fullLabel}</p>
          <p className="mt-0.5 text-admin-ink tabular-nums">{formatPKR(active.value)}</p>
          <p className="text-admin-muted tabular-nums">{active.orders} order{active.orders === 1 ? "" : "s"}</p>
        </div>
      ) : null}
    </div>
  );
}
