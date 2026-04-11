"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { CancelModal } from "@/components/orders/CancelModal";
import {
  OrderDetail,
  type OrderDetailModel,
} from "@/components/orders/OrderDetail";
import { StatusBadge, type ShopOrderStatusPill } from "@/components/orders/StatusBadge";

/** Admin read-only detail + force cancel. */
export default function AdminVendorOrderDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [data, setData] = useState<OrderDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/orders/admin/shop/${encodeURIComponent(id)}`,
        { credentials: "same-origin" }
      );
      const j = (await r.json()) as { order?: OrderDetailModel; error?: string };
      if (!r.ok) {
        toast.error(j.error || "Not found");
        setData(null);
        return;
      }
      if (j.order) setData(j.order);
    } catch {
      toast.error("Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function forceCancel(reason: string) {
    if (!id) return;
    const r = await fetch(
      `/api/orders/admin/shop/${encodeURIComponent(id)}/cancel`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason }),
      }
    );
    const j = (await r.json()) as { error?: string };
    if (!r.ok) {
      toast.error(j.error || "Cancel failed");
      throw new Error(j.error);
    }
    toast.success("Order cancelled");
    await load();
  }

  if (loading) {
    return <div className="p-8 text-darkText/60">Loading…</div>;
  }
  if (!data) {
    return (
      <div className="p-8">
        <Link href="/admin/vendor-orders" className="text-primaryBlue font-bold">
          ← Seller orders
        </Link>
      </div>
    );
  }

  const canCancel =
    data.orderStatus !== "delivered" && data.orderStatus !== "cancelled";

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Link
        href="/admin/vendor-orders"
        className="mb-6 inline-block text-sm font-bold text-primaryBlue hover:underline"
      >
        ← Seller orders
      </Link>

      <div className="rounded-card border border-borderGray bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-darkText">
              {data.shopOrderNumber}
            </h1>
            <p className="mt-1 text-sm text-darkText/60">
              Checkout{" "}
              <span className="font-mono text-sky-600">{data.parentOrderNumber}</span>
            </p>
          </div>
          <StatusBadge status={data.orderStatus as ShopOrderStatusPill} />
        </div>

        <div className="mt-8">
          <OrderDetail order={data} showVendorBlock />
        </div>

        {canCancel ? (
          <div className="mt-8 border-t border-borderGray pt-6">
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700"
            >
              Force cancel order
            </button>
            <p className="mt-2 text-xs text-darkText/50">
              Use only when the seller or customer cannot resolve the order in the panel.
            </p>
          </div>
        ) : null}
      </div>

      <CancelModal
        open={cancelOpen}
        title="Force cancel (admin)"
        onClose={() => setCancelOpen(false)}
        onConfirm={forceCancel}
      />
    </div>
  );
}
