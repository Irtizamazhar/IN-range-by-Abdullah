"use client";

import { formatPKR } from "@/lib/format";
import type { ShopOrderJson } from "@/lib/vendor-shop-order-helpers";
import { StatusTimeline } from "./StatusTimeline";

export type OrderDetailModel = ShopOrderJson & {
  paymentMethodLabel: string;
};

type Props = {
  order: OrderDetailModel;
  /** Show seller block (admin view). */
  showVendorBlock?: boolean;
};

/**
 * Read-only sections: customer, line items, commission breakdown, payment, timeline.
 * Action buttons live in the parent page.
 */
export function OrderDetail({ order, showVendorBlock }: Props) {
  const v = order.vendor;
  return (
    <div className="space-y-8">
      {showVendorBlock && v ? (
        <section className="rounded-card border border-borderGray bg-sky-50/50 p-4">
          <h2 className="text-xs font-bold uppercase text-darkText/50">
            Vendor
          </h2>
          <p className="mt-1 font-semibold text-darkText">{v.shopName}</p>
          <p className="text-sm text-darkText/80">
            {v.ownerName} · {v.email} · {v.phone}
          </p>
          <p className="text-sm text-darkText/60">{v.city}</p>
        </section>
      ) : null}

      <section>
        <h2 className="text-xs font-bold uppercase text-darkText/50">
          Customer
        </h2>
        <p className="mt-1 font-semibold text-darkText">{order.customerName}</p>
        <p className="text-sm text-darkText/80">{order.customerPhone}</p>
        <p className="text-sm text-darkText/80">{order.customerEmail}</p>
        <p className="mt-2 text-sm text-darkText/90">
          {order.customerAddress}, {order.city}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase text-darkText/50">
          Products
        </h2>
        <ul className="divide-y divide-borderGray rounded-lg border border-borderGray">
          {order.items.map((it, idx) => (
            <li
              key={`${it.productId}-${idx}`}
              className="flex flex-wrap justify-between gap-2 p-3 text-sm"
            >
              <div>
                <span className="font-medium text-darkText">
                  {it.productName}
                </span>
                {it.variant ? (
                  <span className="text-darkText/60"> · {it.variant}</span>
                ) : null}
                <span className="text-darkText/60"> × {it.quantity}</span>
              </div>
              <div className="text-right">
                <div className="text-darkText/60">
                  {formatPKR(it.price)} each
                </div>
                <div className="font-semibold">
                  {formatPKR(it.subtotal)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-borderGray bg-white p-4">
        <h2 className="text-xs font-bold uppercase text-darkText/50">
          Price breakdown
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-darkText/70">Subtotal (your items)</dt>
            <dd className="font-medium">{formatPKR(Number(order.totalAmount))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-darkText/70">Marketplace commission</dt>
            <dd className="font-medium text-amber-800">
              {formatPKR(Number(order.commissionAmount))}
            </dd>
          </div>
          <div className="flex justify-between border-t border-borderGray pt-2 text-base">
            <dt className="font-bold text-darkText">Net payable to vendor</dt>
            <dd className="font-extrabold text-green-700">
              {formatPKR(Number(order.netAmount))}
            </dd>
          </div>
        </dl>
      </section>

      <section className="text-sm">
        <h2 className="text-xs font-bold uppercase text-darkText/50">
          Payment
        </h2>
        <p className="mt-1">
          Method: <strong>{order.paymentMethodLabel}</strong> ({order.paymentMethod})
        </p>
        <p>
          Status: <strong>{order.paymentStatus}</strong>
        </p>
        <p className="mt-1 text-darkText/60">
          Parent checkout:{" "}
          <span className="font-mono">{order.parentOrderNumber}</span>
        </p>
        {order.trackingNumber ? (
          <p className="mt-2">
            Tracking:{" "}
            <span className="font-mono font-semibold">{order.trackingNumber}</span>
          </p>
        ) : null}
        {order.cancelReason ? (
          <p className="mt-2 text-red-700">
            Cancel reason: {order.cancelReason}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase text-darkText/50">
          Status timeline
        </h2>
        <StatusTimeline entries={order.statusHistory} />
      </section>
    </div>
  );
}
