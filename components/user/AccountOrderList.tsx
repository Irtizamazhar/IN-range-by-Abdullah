"use client";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { AccountFilterToolbar } from "@/components/user/AccountPageParts";
import { Eye, FileText, Package, RotateCcw, Truck, XCircle } from "lucide-react";
import { formatPKR } from "@/lib/format";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

export type AccountOrder = { id: string; orderNumber: string; orderStatus: string; paymentStatus: string; totalAmount: number; createdAt: string; canCancel: boolean; hasDeliveredItems: boolean; items: { id: string; name: string; quantity: number; image?: string }[] };

/** Customer-facing order statuses (see `resolveCustomerOrderTrackStatus`); `null` is All Orders. */
export const ORDER_FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: "All Orders" }, { value: "pending", label: "Pending" }, { value: "processing", label: "Processing" }, { value: "confirmed", label: "Confirmed" },
  { value: "packing", label: "Packing" }, { value: "shipped", label: "Shipped" }, { value: "delivered", label: "Delivered" }, { value: "cancelled", label: "Cancelled" },
];
const STATUS_TONE: Record<string, string> = { confirmed: "text-emerald-700 before:bg-emerald-500", processing: "text-sky-700 before:bg-sky-500", packing: "text-sky-700 before:bg-sky-500", shipped: "text-indigo-700 before:bg-indigo-500", delivered: "text-emerald-800 before:bg-emerald-600", cancelled: "text-red-700 before:bg-red-500" };
const PAYMENT: Record<string, [string, string]> = { pending: ["Payment pending", "bg-amber-50 text-amber-800"], submitted: ["Payment submitted", "bg-sky-50 text-sky-800"], received: ["Paid", "bg-emerald-50 text-emerald-800"], failed: ["Payment failed", "bg-red-50 text-red-700"] };
const label = (value: string) => value.replaceAll("_", " ").replace(/^\w/, c => c.toUpperCase());
const ordersHref = (status: string | null, sort: string) => `/account?tab=orders${status ? `&status=${status}` : ""}${sort === "oldest" ? "&sort=oldest" : ""}`;
const action = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-link sm:min-h-10";

/** Status filter pills and sort for the Orders tab. */
export function OrderToolbar({ status, sort }: { status: string | null; sort: string }) {
  return <AccountFilterToolbar label="Filter orders by status" filters={ORDER_FILTERS.map(f => ({ label: f.label, href: ordersHref(f.value, sort), active: status === f.value }))} sort={sort} sortHref={value => ordersHref(status, value)} />;
}

/** One order: number, date, statuses and first item on the left; total and actions on the right (stacked on phones). */
export function OrderCard({ order }: { order: AccountOrder }) {
  const [first, ...rest] = order.items; const payment = PAYMENT[order.paymentStatus] || [`Payment ${label(order.paymentStatus).toLowerCase()}`, "bg-gray-100 text-gray-700"];
  return <article aria-labelledby={`order-${order.id}`} className="rounded-2xl border border-[#E3ECE6] bg-white p-4 shadow-[0_1px_2px_rgba(0,61,43,0.04)] sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`order-${order.id}`} className="min-w-0 break-words text-[17px] font-bold text-brand-dark sm:text-lg">{order.orderNumber}</h2>
          <p className="shrink-0 text-[17px] font-bold tabular-nums text-[#005235] lg:hidden">{formatPKR(order.totalAmount)}</p>
        </div>
        <p className="mt-0.5 text-[13px] text-darkText/60 sm:text-sm">{new Date(order.createdAt).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-[13px]">
          <span className={`inline-flex items-center gap-1.5 font-semibold before:h-1.5 before:w-1.5 before:rounded-full ${STATUS_TONE[order.orderStatus] || "text-darkText/70 before:bg-gray-400"}`}><span className="sr-only">Order status: </span>{label(order.orderStatus)}</span>
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${payment[1]}`}>{payment[0]}</span>
        </p>
        {first && <div className="mt-3 flex items-center gap-3">
          <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E3ECE6] bg-[#F7FAF5]">
            {first.image ? <Image src={first.image} alt="" fill sizes="48px" className="object-contain p-1" unoptimized={shouldUnoptimizeImageSrc(first.image)} /> : <Package className="h-5 w-5 text-darkText/35" aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className="line-clamp-2 break-words text-sm font-semibold text-brand-dark sm:text-[15px]">{first.name}</span>
            <span className="block text-[13px] text-darkText/60">Qty: {first.quantity}{rest.length > 0 && ` · +${rest.length} more ${rest.length === 1 ? "item" : "items"}`}</span>
          </span>
        </div>}
      </div>
      <div className="flex flex-col gap-3 border-t border-[#EEF3EF] pt-4 lg:w-auto lg:shrink-0 lg:items-end lg:justify-between lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <p className="hidden text-lg font-bold tabular-nums text-[#005235] lg:block">{formatPKR(order.totalAmount)}</p>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap lg:justify-end">
          <Link href={`/account/orders/${order.id}`} className={`${action} bg-brand-primary text-brand-dark hover:bg-brand-hover`}><Eye className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="sm:hidden">Details</span><span className="hidden sm:inline">Order details</span><span className="sr-only"> for order {order.orderNumber}</span></Link>
          <Link href={`/track-order?order=${encodeURIComponent(order.orderNumber)}`} className={`${action} border border-[#DFEDE5] bg-white text-brand-dark hover:bg-brand-soft`}><Truck className="h-4 w-4 shrink-0" aria-hidden="true" />Track<span className="sr-only"> order {order.orderNumber}</span></Link>
          <Link href={`/invoice/${order.id}`} className={`${action} border border-[#DFEDE5] bg-white text-brand-dark hover:bg-brand-soft`}><FileText className="h-4 w-4 shrink-0" aria-hidden="true" />Invoice<span className="sr-only"> for order {order.orderNumber}</span></Link>
          {order.canCancel && <Link href={`/account/orders/${order.id}#cancel`} className={`${action} col-span-3 border border-red-200 bg-white text-red-600 hover:bg-red-50`}><XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />Cancel order<span className="sr-only"> {order.orderNumber}</span></Link>}
          {order.hasDeliveredItems && <Link href="/my-stuff" className={`${action} col-span-3 border border-[#DFEDE5] bg-white text-brand-link hover:bg-brand-soft`}><RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />Returns / After-sales</Link>}
        </div>
      </div>
    </div>
  </article>;
}

export function filterLabel(status: string | null) { return ORDER_FILTERS.find(f => f.value === status)?.label || "All Orders"; }
export { ordersHref };
