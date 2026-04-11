"use client";

import Link from "next/link";
import { formatPKR } from "@/lib/format";
import type { ShopOrderListRow } from "./shop-order-types";
import { StatusBadge, type ShopOrderStatusPill } from "./StatusBadge";

type Props = {
  rows: ShopOrderListRow[];
  getDetailHref: (id: string) => string;
  showVendor?: boolean;
};

/** Stacked cards for small screens (same data as OrderTable). */
export function OrderCard({ rows, getDetailHref, showVendor }: Props) {
  if (rows.length === 0) {
    return (
      <p className="md:hidden rounded-card border border-borderGray bg-white p-6 text-center text-sm text-darkText/50">
        No orders match this view.
      </p>
    );
  }
  return (
    <div className="space-y-3 md:hidden">
      {rows.map((r) => (
        <div
          key={r.id}
          className="rounded-card border border-borderGray bg-white p-4 shadow-card"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-sm text-sky-600">{r.shopOrderNumber}</p>
              <p className="font-semibold text-darkText">{r.customerName}</p>
            <p className="text-xs text-darkText/50">{r.city}</p>
            {showVendor && r.vendor ? (
              <p className="text-xs font-medium text-darkText/70">
                {r.vendor.shopName}
              </p>
            ) : null}
          </div>
            <StatusBadge status={r.orderStatus as ShopOrderStatusPill} />
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
            <span className="text-darkText/60">
              {r.itemCount} items ·{" "}
              {new Date(r.placedAt).toLocaleDateString()}
            </span>
            <span className="font-bold">{formatPKR(Number(r.totalAmount))}</span>
          </div>
          <Link
            href={getDetailHref(r.id)}
            className="mt-3 inline-block text-sm font-bold text-primaryBlue"
          >
            View details →
          </Link>
        </div>
      ))}
    </div>
  );
}
