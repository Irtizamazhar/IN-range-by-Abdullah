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
import { VendorStatusDropdown } from "@/components/orders/VendorStatusDropdown";

export default function VendorShopOrderDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [data, setData] = useState<OrderDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [trackEdit, setTrackEdit] = useState("");
  const [trackBusy, setTrackBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/orders/vendor/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      const j = (await r.json()) as { order?: OrderDetailModel; error?: string };
      if (!r.ok) {
        toast.error(j.error || "Not found");
        setData(null);
        return;
      }
      if (j.order) {
        setData(j.order);
        setTrackEdit(j.order.trackingNumber || "");
      }
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

  async function saveTrackingOnly() {
    if (!id) return;
    setTrackBusy(true);
    try {
      const r = await fetch(
        `/api/orders/vendor/${encodeURIComponent(id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            updateTrackingOnly: true,
            trackingNumber: trackEdit.trim() || null,
          }),
        }
      );
      const j = (await r.json()) as { error?: string };
      if (!r.ok) {
        toast.error(j.error || "Could not save tracking");
        return;
      }
      toast.success("Tracking saved");
      await load();
    } finally {
      setTrackBusy(false);
    }
  }

  async function cancel(reason: string) {
    if (!id) return;
    const r = await fetch(
      `/api/orders/vendor/${encodeURIComponent(id)}/cancel`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
    return (
      <div className="mx-auto max-w-3xl p-6 text-darkText/60 md:p-8">
        Loading…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-8">
        <Link href="/vendor/dashboard/orders" className="font-bold text-primaryBlue">
          ← Back to orders
        </Link>
      </div>
    );
  }

  const canAct =
    data.orderStatus !== "delivered" && data.orderStatus !== "cancelled";

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Link
        href="/vendor/dashboard/orders"
        className="mb-6 inline-block text-sm font-bold text-primaryBlue hover:underline"
      >
        ← Orders
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
          <OrderDetail order={data} />
        </div>

        {data.orderStatus === "shipped" ? (
          <div className="mt-8 border-t border-borderGray pt-6">
            <p className="mb-2 text-sm font-bold text-darkText">
              Update tracking
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                value={trackEdit}
                onChange={(e) => setTrackEdit(e.target.value)}
                className="min-w-[200px] flex-1 rounded-lg border border-borderGray px-3 py-2 text-sm"
                placeholder="Courier tracking number"
              />
              <button
                type="button"
                disabled={trackBusy}
                onClick={() => void saveTrackingOnly()}
                className="rounded-xl border border-borderGray bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
              >
                Save tracking
              </button>
            </div>
          </div>
        ) : null}

        {canAct ? (
          <div className="mt-8 space-y-4 border-t border-borderGray pt-6">
            <VendorStatusDropdown
              currentStatus={data.orderStatus as ShopOrderStatusPill}
              statusUrl={`/api/orders/vendor/${encodeURIComponent(id)}/status`}
              onSuccess={() => void load()}
            />
            <div>
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="rounded-xl border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-800 hover:bg-red-100"
              >
                Cancel order
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <CancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancel}
      />
    </div>
  );
}
