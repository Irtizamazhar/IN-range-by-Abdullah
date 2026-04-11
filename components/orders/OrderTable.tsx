"use client";

import Link from "next/link";
import { formatPKR } from "@/lib/format";
import type { ShopOrderListRow } from "./shop-order-types";
import { StatusBadge, type ShopOrderStatusPill } from "./StatusBadge";

type Props = {
  rows: ShopOrderListRow[];
  /** e.g. (id) => `/vendor/dashboard/orders/${id}` */
  getDetailHref: (id: string) => string;
  /** When true, adds a Vendor column (admin list). */
  showVendorColumn?: boolean;
};

/** Desktop table: Order ID, customer, items count, total, status, date, action. */
export function OrderTable({
  rows,
  getDetailHref,
  showVendorColumn = false,
}: Props) {
  return (
    <div className="hidden overflow-x-auto rounded-card border border-borderGray bg-white shadow-card md:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-primaryYellow bg-primaryYellow text-white">
          <tr>
            <th className="p-3">Order ID</th>
            {showVendorColumn ? (
              <th className="p-3">Vendor</th>
            ) : null}
            <th className="p-3">Customer</th>
            <th className="p-3">Items</th>
            <th className="p-3">Total</th>
            <th className="p-3">Status</th>
            <th className="p-3">Date</th>
            <th className="p-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={showVendorColumn ? 8 : 7}
                className="p-8 text-center text-darkText/50"
              >
                No orders match this view.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-borderGray odd:bg-white even:bg-sky-50/60"
              >
                <td className="p-3 font-mono text-sky-600">{r.shopOrderNumber}</td>
                {showVendorColumn ? (
                  <td className="p-3 text-sm">
                    {r.vendor?.shopName ?? "—"}
                  </td>
                ) : null}
                <td className="p-3">
                  <div className="font-medium">{r.customerName}</div>
                  <div className="text-xs text-darkText/50">{r.city}</div>
                </td>
                <td className="p-3">{r.itemCount}</td>
                <td className="p-3 font-semibold">
                  {formatPKR(Number(r.totalAmount))}
                </td>
                <td className="p-3">
                  <StatusBadge status={r.orderStatus as ShopOrderStatusPill} />
                </td>
                <td className="p-3 text-darkText/70">
                  {new Date(r.placedAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  <Link
                    href={getDetailHref(r.id)}
                    className="font-bold text-primaryBlue hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
