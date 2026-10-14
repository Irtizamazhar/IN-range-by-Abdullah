"use client";

import { ChevronDown } from "lucide-react";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";

export const VENDOR_SALES_RANGES = { "7d": "Last 7 days", "30d": "Last 30 days" } as const;
export type VendorSalesRange = keyof typeof VENDOR_SALES_RANGES;

export function SalesRangeSelect({ value }: { value: VendorSalesRange }) {
  const router = useLoadingRouter();
  return (
    <label className="relative inline-flex shrink-0">
      <span className="sr-only">Sales period</span>
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value as VendorSalesRange;
          void router.push(next === "7d" ? "/vendor/dashboard" : `/vendor/dashboard?range=${next}`, { scroll: false });
        }}
        className="h-10 appearance-none rounded-lg border border-admin-border bg-white pl-3 pr-9 text-sm font-medium text-admin-ink hover:border-admin-primary/30 focus:outline-none focus:ring-2 focus:ring-admin-primary/20"
      >
        {Object.entries(VENDOR_SALES_RANGES).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-ink" aria-hidden />
    </label>
  );
}
