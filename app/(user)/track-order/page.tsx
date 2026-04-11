"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { WhatsAppButton } from "@/components/user/WhatsAppButton";
import {
  RateYourProductsSection,
  type RateProductLine,
} from "@/components/user/RateYourProductsSection";

const STEPS = [
  "pending",
  "confirmed",
  "processing",
  "packing",
  "shipped",
  "delivered",
] as const;

type Step = (typeof STEPS)[number];

function stepIndex(s: string): number {
  const i = STEPS.indexOf(s as Step);
  return i >= 0 ? i : 0;
}

export default function TrackOrderPage() {
  const searchParams = useSearchParams();
  const [num, setNum] = useState("");
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [myOrders, setMyOrders] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [wa, setWa] = useState("923001234567");
  const detailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => s.whatsappNumber && setWa(s.whatsappNumber))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const initialOrder = searchParams?.get("order");
    if (initialOrder) {
      setNum(initialOrder);
      void lookupByNumber(initialOrder);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/orders/mine")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.orders?.length) {
          setMyOrders(data.orders);
        }
      })
      .catch(() => {});
  }, []);

  async function lookupByNumber(raw: string) {
    const id = raw.trim();
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Order not found");
        setOrder(null);
        return;
      }
      setOrder(data);
      window.setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } finally {
      setLoading(false);
    }
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    await lookupByNumber(num);
  }

  async function cancelOrder() {
    if (!order) return;
    const id = String(order.orderNumber || order._id);
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not cancel order");
      return;
    }
    toast.success("Order cancelled");
    setOrder(data);
  }

  const status = order ? String(order.orderStatus) : "";
  const canCancel =
    order &&
    ["pending", "confirmed", "processing"].includes(status);
  const blockedMsg =
    order &&
    ["packing", "shipped", "delivered", "cancelled"].includes(status);
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold text-yellow-400">Track Your Order</h1>
      <p className="mb-6 text-sm font-normal text-darkText/60">
        Enter your order number and view the latest status timeline.
      </p>
      <form onSubmit={lookup} className="flex gap-2 mb-10">
        <input
          className="flex-1 rounded-xl border border-borderGray px-4 py-2.5 text-base font-normal"
          placeholder="Order number (e.g. IRB-001)"
          value={num}
          onChange={(e) => setNum(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-primaryBlue px-6 py-2.5 text-base font-semibold text-white disabled:opacity-50"
        >
          {loading ? "…" : "Track"}
        </button>
      </form>

      {myOrders.length > 0 ? (
        <div className="mb-8 rounded-card border border-borderGray bg-white p-4 shadow-card">
          <p className="mb-3 text-base font-semibold text-darkText">Your recent orders</p>
          <div className="space-y-2">
            {myOrders.slice(0, 8).map((o) => {
              const id = String(o.orderNumber || o.id || "");
              return (
                <div
                  key={id}
                  className="flex flex-col gap-2 border-b border-borderGray p-3 transition-colors hover:bg-yellow-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-base font-bold text-sky-500">{id}</p>
                    <p className="text-xs font-normal text-darkText/60 capitalize">
                      Status: {String(o.orderStatus || "pending")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNum(id);
                      void lookupByNumber(id);
                    }}
                    className="rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-medium text-black hover:bg-yellow-500"
                  >
                    Track now
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-darkText/55">
            Your orders stay available here when you are signed in.
          </p>
        </div>
      ) : null}

      {order ? (
        <div
          ref={detailRef}
          className="space-y-6 rounded-card border border-sky-100 border-t-4 border-t-yellow-400 bg-white p-6 shadow-card"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-darkText/60">Order</p>
            <p className="text-2xl font-bold text-sky-500">
              {String(order.orderNumber)}
            </p>
            <p className="mt-2 text-sm">
              <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-semibold text-black">
                {status}
              </span>
            </p>
          </div>

          <div>
            <p className="mb-3 text-lg font-semibold text-yellow-500">Timeline</p>
            {status === "cancelled" ? (
              <p className="text-sm font-medium text-red-700">
                Order cancelled — timeline not shown.
              </p>
            ) : (
              <ul className="ml-1.5 space-y-1 border-l-2 border-gray-200">
                {STEPS.map((s) => {
                  const active = stepIndex(status) >= STEPS.indexOf(s);
                  const current = status === s;
                  return (
                    <li
                      key={s}
                      className={`relative flex items-center gap-3 py-1 pl-6 text-sm ${
                        current
                          ? "font-bold text-sky-600"
                          : active
                            ? "font-semibold text-black"
                            : "text-gray-400"
                      }`}
                    >
                      <span
                        className={`absolute -left-[7px] h-3 w-3 shrink-0 rounded-full ${
                          current
                            ? "animate-pulse bg-sky-400"
                            : active
                              ? "bg-yellow-400"
                              : "bg-gray-300"
                        }`}
                      />
                      <span className={current ? "font-bold" : ""}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {status === "delivered" && order ? (
            <RateYourProductsSection
              parentOrderId={String(order._id || order.id || "").trim()}
              lines={
                Array.isArray(order.products)
                  ? (order.products as RateProductLine[])
                  : []
              }
            />
          ) : null}

          {canCancel ? (
            <button
              type="button"
              onClick={cancelOrder}
              className="w-full rounded-lg border-2 border-red-400 py-2.5 font-semibold text-red-500 hover:bg-red-50"
            >
              Cancel order
            </button>
          ) : null}

          {blockedMsg && !canCancel && status !== "cancelled" ? (
            <p className="text-sm text-amber-800 bg-amber-50 rounded-xl p-3">
              This order is already being packed and can no longer be cancelled.
            </p>
          ) : null}

          {status === "cancelled" ? (
            <p className="text-sm text-darkText/70">This order has been cancelled.</p>
          ) : null}

          <WhatsAppButton number={wa} label="WhatsApp support" className="w-full justify-center rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}
