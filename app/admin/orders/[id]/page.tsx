"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatPKR } from "@/lib/format";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";
import {
  ChevronRight,
  Clipboard,
  Download,
  Mail,
  MapPin,
  Phone,
  Printer,
  User,
  X,
} from "lucide-react";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const id = String((params?.id as string | undefined) ?? "");
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [tracking, setTracking] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [showShippingLabel, setShowShippingLabel] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders/${id}?admin=1`);
    const data = await res.json();
    if (!res.ok) {
      toast.error("Order not found");
      return;
    }
    setOrder(data);
    setStatus(String(data.orderStatus));
    setPayStatus(String(data.paymentStatus));
    setTracking(String(data.trackingNumber || ""));
    await fetch(`/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  async function saveStatus() {
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderStatus: status,
          paymentStatus: payStatus,
          trackingNumber: tracking.trim() || undefined,
        }),
      });
      if (!res.ok) {
        toast.error("Update failed");
        return;
      }
      toast.success("Changes saved");
      await load();
    } finally {
      setSavingStatus(false);
    }
  }

  if (!order) {
    return (
      <div className="p-8 text-darkText/50">
        <Link href="/admin/orders" className="text-primaryBlue">
          ← Orders
        </Link>
        <p className="mt-4">Loading…</p>
      </div>
    );
  }

  const products = (order.products as Record<string, unknown>[]) || [];
  const totalAmount = Number(order.totalAmount || 0);
  const orderNumber = String(order.orderNumber || id).toUpperCase();
  const createdAt = order.createdAt ? new Date(String(order.createdAt)) : null;
  const formattedDate = createdAt
    ? createdAt.toLocaleString("en-PK", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Date unavailable";

  const orderStatusPill =
    status === "delivered"
      ? "bg-green-600 text-white border-green-600"
      : status === "pending"
        ? "bg-amber-500 text-white border-amber-500"
        : status === "cancelled"
          ? "bg-red-600 text-white border-red-600"
          : "bg-gray-100 text-gray-700 border-gray-200";

  const paymentStatusPill =
    payStatus === "received"
      ? "bg-green-600 text-white border-green-600"
      : payStatus === "pending"
        ? "bg-amber-500 text-white border-amber-500"
        : payStatus === "rejected" || payStatus === "failed"
          ? "bg-red-600 text-white border-red-600"
          : "bg-gray-100 text-gray-700 border-gray-200";

  const cardClass =
    "rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md";
  const formattedOrderStatus = status.replace(/_/g, " ");
  const statusDotClass =
    status === "delivered"
      ? "bg-green-500"
      : status === "pending"
        ? "bg-amber-500"
        : status === "cancelled"
          ? "bg-red-500"
          : "bg-blue-500";
  const paymentDotClass =
    payStatus === "received"
      ? "bg-green-500"
      : payStatus === "pending"
        ? "bg-amber-500"
        : payStatus === "rejected" || payStatus === "failed"
          ? "bg-red-500"
          : "bg-gray-400";

  async function copyTrackingNumber() {
    if (!tracking.trim()) {
      toast.error("No tracking number to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(tracking.trim());
      toast.success("Tracking number copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  function printShippingLabel() {
    if (!order) {
      toast.error("Order not loaded");
      return;
    }
    window.print();
  }

  async function downloadShippingLabel() {
    if (!order) {
      toast.error("Order not loaded");
      return;
    }
    const source = document.getElementById("shipping-label-print-area");
    if (!source) {
      toast.error("Label not found");
      return;
    }

    try {
      const rect = source.getBoundingClientRect();
      const clone = source.cloneNode(true) as HTMLElement;
      clone.setAttribute(
        "style",
        [
          "margin:0",
          "padding:16px",
          "width:100%",
          "box-sizing:border-box",
          "background:#ffffff",
        ].join(";")
      );

      const inlineStyles = (srcEl: Element, targetEl: Element) => {
        const srcHtml = srcEl as HTMLElement;
        const targetHtml = targetEl as HTMLElement;
        const style = window.getComputedStyle(srcHtml);
        const inline = Array.from(style)
          .map((prop) => `${prop}:${style.getPropertyValue(prop)};`)
          .join("");
        targetHtml.setAttribute("style", inline);
        const srcChildren = Array.from(srcEl.children);
        const targetChildren = Array.from(targetEl.children);
        srcChildren.forEach((child, idx) => {
          if (targetChildren[idx]) inlineStyles(child, targetChildren[idx]!);
        });
      };
      inlineStyles(source, clone);

      const serializer = new XMLSerializer();
      const html = serializer.serializeToString(clone);
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(rect.width)}" height="${Math.ceil(rect.height)}">
          <foreignObject width="100%" height="100%">${html}</foreignObject>
        </svg>
      `;
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

      const image = new window.Image();
      image.crossOrigin = "anonymous";
      image.src = svgUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not render label"));
      });

      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(rect.width * scale));
      canvas.height = Math.max(1, Math.ceil(rect.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        toast.error("Could not prepare download");
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(image, 0, 0, rect.width, rect.height);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `shipping-label-${orderNumber}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Label image downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link
            href="/admin/orders"
            className="font-medium text-indigo-600 transition hover:text-indigo-700"
          >
            Orders
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-700">{orderNumber}</span>
        </nav>

        <div className="mt-4 mb-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">
              #{orderNumber}
            </h1>
            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Order record
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
            <span className="inline-flex items-center gap-2">
              <User className="h-4 w-4 text-[#4f46e5]" />
              <span className="font-semibold text-gray-700">{String(order.customerName)}</span>
            </span>
            <span className="hidden h-4 w-px bg-gray-200 sm:block" />
            <span className="inline-flex items-center gap-2">
              <Phone className="h-4 w-4 text-indigo-500" />
              {String(order.customerPhone)}
            </span>
            <span className="hidden h-4 w-px bg-gray-200 sm:block" />
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-indigo-500" />
              {String(order.customerEmail)}
            </span>
          </div>
        </div>

        <div className="mb-6 border-b border-gray-200" />

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className={`${cardClass} border-l-4 border-l-indigo-500`}>
            <div className="mb-4 flex items-end justify-between border-b border-gray-100 pb-3">
              <h2 className="text-lg font-bold text-gray-900">Order Details</h2>
              <p className="text-xs font-medium text-gray-500">{formattedDate}</p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700">Status</label>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${orderStatusPill}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass}`} />
                    {formattedOrderStatus}
                  </span>
                </div>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold capitalize text-gray-700 transition hover:border-indigo-300 focus:border-indigo-400 focus:outline-none"
                  >
                    {[
                      "pending",
                      "confirmed",
                      "processing",
                      "packing",
                      "shipped",
                      "delivered",
                      "cancelled",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700">Payment Status</label>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${paymentStatusPill}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${paymentDotClass}`} />
                    {payStatus}
                  </span>
                </div>
                <select
                  value={payStatus}
                  onChange={(e) => setPayStatus(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold capitalize text-gray-700 transition hover:border-indigo-300 focus:border-indigo-400 focus:outline-none"
                >
                  {["pending", "received", "failed", "rejected"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Tracking Number
                </label>
                <div className="flex overflow-hidden rounded-xl border border-gray-200">
                  <input
                    className="w-full px-3 py-2 text-sm transition focus:outline-none"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={copyTrackingNumber}
                    className="inline-flex items-center gap-2 border-l border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                    title="Copy tracking number"
                  >
                    <Clipboard className="h-4 w-4" />
                    Copy
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={saveStatus}
                disabled={savingStatus}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {savingStatus ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>

        </div>

        <div className={`${cardClass} mb-6`}>
          <h2 className="mb-4 text-lg font-bold text-gray-900">Items</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Unit Price</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => {
                  const name = String(p.name || "Item");
                  const quantity = Number(p.quantity || 0);
                  const price = Number(p.price || 0);
                  const rowTotal = price * quantity;
                  const imageUrl = String(
                    p.image || p.imageUrl || p.productImage || p.thumbnail || "",
                  );

                  return (
                    <tr
                      key={i}
                      className={i % 2 === 0 ? "bg-white transition hover:bg-gray-50" : "bg-gray-50 transition hover:bg-gray-100"}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={name}
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-md border border-gray-200 object-cover"
                              unoptimized={shouldUnoptimizeImageSrc(imageUrl)}
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-800">{name}</p>
                            {p.variant ? (
                              <p className="text-xs text-gray-500">{String(p.variant)}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-700">{quantity}</td>
                      <td className="px-4 py-3 text-gray-700">{formatPKR(price)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {formatPKR(rowTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-t border-gray-200 pt-4 text-right">
            <p className="text-lg font-extrabold text-blue-600">
              Total {formatPKR(Number(order.totalAmount))}
            </p>
          </div>
        </div>

        <div className={cardClass}>
          <div className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-3">
            <MapPin className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-700">Address</h2>
          </div>
          <div className="space-y-1 text-sm leading-6 font-medium text-gray-700">
            <p>{String(order.customerAddress || "N/A")}</p>
            <p>{String(order.city || "N/A")}</p>
            <p>{String(order.region || order.province || "N/A")}</p>
          </div>
        </div>

        <div className={`${cardClass} mt-6`}>
          <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-700">
              Shipping Label
            </h2>
            <button
              type="button"
              onClick={() => setShowShippingLabel(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              <Printer className="h-4 w-4" />
              Open label
            </button>
          </div>
          <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-700 space-y-2">
            <p className="font-bold text-gray-900">{String(order.customerName || "N/A")}</p>
            <p>{String(order.customerPhone || "N/A")}</p>
            <p className="whitespace-pre-wrap">{String(order.customerAddress || "N/A")}</p>
            <p>
              {String(order.city || "N/A")}
              {order.region || order.province
                ? `, ${String(order.region || order.province)}`
                : ""}
            </p>
            <p className="pt-2 border-t border-gray-200">
              <span className="font-semibold">Order ID:</span> {orderNumber}
            </p>
            <p>
              <span className="font-semibold">Tracking:</span>{" "}
              {tracking.trim() || "Not assigned"}
            </p>
            <p>
              <span className="font-semibold">Grand Total:</span> {formatPKR(totalAmount)}
            </p>
          </div>
        </div>

        {showShippingLabel ? (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              onClick={() => setShowShippingLabel(false)}
              className="absolute inset-0 bg-black/35"
              aria-label="Close shipping label panel"
            />
            <aside className="absolute right-0 top-0 h-full w-full max-w-[560px] overflow-y-auto bg-white p-5 shadow-2xl sm:p-6">
              <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-3">
                <h3 className="text-base font-bold text-gray-900">
                  Shipping Label
                </h3>
                <button
                  type="button"
                  onClick={() => setShowShippingLabel(false)}
                  className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div id="shipping-label-print-area" className="space-y-4">
                <div className="rounded-xl border-2 border-gray-900 bg-white p-4 text-gray-900">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                        Courier Label
                      </p>
                      <p className="text-lg font-extrabold">In Range By Abdullah</p>
                    </div>
                    <p className="text-xs font-semibold text-gray-600">
                      Order ID: {orderNumber}
                    </p>
                  </div>

                  <div className="space-y-1 border-t border-dashed border-gray-300 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                      Ship To
                    </p>
                    <p className="text-xl font-extrabold text-gray-900">
                      {String(order.customerName || "N/A")}
                    </p>
                    <p className="text-lg font-bold">{String(order.customerPhone || "N/A")}</p>
                    <p className="pt-1 text-sm font-medium leading-6">
                      {String(order.customerAddress || "N/A")}
                    </p>
                    <p className="text-sm font-medium">{String(order.city || "N/A")}</p>
                    <p className="border-t border-dashed border-gray-300 pt-2 text-sm font-extrabold">
                      Grand Total: {formatPKR(totalAmount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="shipping-label-actions mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={downloadShippingLabel}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={printShippingLabel}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #shipping-label-print-area,
          #shipping-label-print-area * {
            visibility: visible !important;
          }
          #shipping-label-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 12px;
            background: #fff;
          }
          .shipping-label-actions {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
