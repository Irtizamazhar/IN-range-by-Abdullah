"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { Download, Printer, X } from "lucide-react";
import { CancelModal } from "@/components/orders/CancelModal";
import { formatPKR } from "@/lib/format";
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
  const [showShippingLabel, setShowShippingLabel] = useState(false);

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
  const grandTotal = Number(data.checkoutTotalAmount || data.totalAmount || 0);

  function printShippingLabel() {
    window.print();
  }

  async function downloadShippingLabel() {
    if (!data) return;
    const source = document.getElementById("shipping-label-print-area-vendor");
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
      a.download = `shipping-label-${data.parentOrderNumber}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Label image downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  }

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
              <span className="font-mono text-brand-dark">{data.parentOrderNumber}</span>
            </p>
          </div>
          <StatusBadge status={data.orderStatus as ShopOrderStatusPill} />
        </div>

        <div className="mt-8">
          <OrderDetail order={data} />
        </div>

        <div className="mt-8 rounded-xl border border-borderGray bg-white p-4">
          <div className="mb-3 flex items-center justify-between border-b border-borderGray pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-primaryBlue">
              Shipping Label
            </h2>
            <button
              type="button"
              onClick={() => setShowShippingLabel(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-brand-dark transition hover:bg-brand-hover"
            >
              <Printer className="h-4 w-4" />
              Open label
            </button>
          </div>
          <div className="space-y-2 rounded-lg border border-dashed border-borderGray p-3 text-sm">
            <p className="font-bold text-darkText">{data.customerName}</p>
            <p className="text-darkText/90">{data.customerPhone}</p>
            <p className="whitespace-pre-wrap text-darkText/90">
              {data.customerAddress}
            </p>
            <p className="text-darkText/90">{data.city}</p>
            <p className="border-t border-borderGray pt-2 text-darkText/90">
              <span className="font-semibold">Order ID:</span>{" "}
              {data.parentOrderNumber}
            </p>
            <p className="text-darkText/90 font-semibold">
              <span className="font-semibold">Grand Total:</span> {formatPKR(grandTotal)}
            </p>
          </div>
        </div>

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

      {showShippingLabel ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setShowShippingLabel(false)}
            className="absolute inset-0 bg-black/35"
            aria-label="Close shipping label panel"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-[560px] overflow-y-auto bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-borderGray pb-3">
              <h3 className="text-base font-bold text-darkText">
                Shipping Label
              </h3>
              <button
                type="button"
                onClick={() => setShowShippingLabel(false)}
                className="rounded-md p-1.5 text-darkText/70 hover:bg-lightGray"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div id="shipping-label-print-area-vendor" className="space-y-4">
              <div className="rounded-xl border-2 border-darkText bg-white p-4 text-darkText">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-darkText/50">
                      Courier Label
                    </p>
                    <p className="text-lg font-extrabold">In Range By Abdullah</p>
                  </div>
                  <p className="text-xs font-semibold text-darkText/70">
                    Order ID: {data.parentOrderNumber}
                  </p>
                </div>
                <div className="space-y-1 border-t border-dashed border-borderGray pt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-darkText/50">
                    Ship To
                  </p>
                  <p className="text-xl font-extrabold">{data.customerName}</p>
                  <p className="text-lg font-bold">{data.customerPhone}</p>
                  <p className="pt-1 text-sm font-medium leading-6">
                    {data.customerAddress}
                  </p>
                  <p className="text-sm font-medium">{data.city}</p>
                  <p className="border-t border-dashed border-borderGray pt-2 text-sm font-extrabold">
                    Grand Total: {formatPKR(grandTotal)}
                  </p>
                </div>
              </div>
            </div>

            <div className="shipping-label-actions-vendor mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={downloadShippingLabel}
                className="inline-flex items-center gap-2 rounded-lg border border-primaryBlue/20 bg-primaryBlue/10 px-4 py-2 text-sm font-semibold text-primaryBlue hover:bg-primaryBlue/15"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                type="button"
                onClick={printShippingLabel}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-hover"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #shipping-label-print-area-vendor,
          #shipping-label-print-area-vendor * {
            visibility: visible !important;
          }
          #shipping-label-print-area-vendor {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 12px;
            background: #fff;
          }
          .shipping-label-actions-vendor {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
