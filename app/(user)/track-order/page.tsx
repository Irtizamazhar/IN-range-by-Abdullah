"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import Link from "@/components/ui/LoadingLink";
import { LogoMark } from "@/components/user/LogoMark";
import { WhatsAppButton } from "@/components/user/WhatsAppButton";
import {
  RateYourProductsSection,
  type RateProductLine,
} from "@/components/user/RateYourProductsSection";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatPKR } from "@/lib/format";
import type { TrackingEvent, TrackingStatus } from "@/lib/order-tracking-timeline";
import {
  ArrowLeft, Ban, Bike, Box, Check, CircleAlert, ClipboardList, CreditCard, Headset, House, LogIn,
  MapPin, MessageCircle, Package, PackageCheck, Phone, Search, Tag, Truck, User, type LucideIcon,
} from "lucide-react";

type Icon = LucideIcon;

type TrackedProduct = { id: string; productId?: string | null; name: string; price: number; quantity: number; image?: string; variant?: string | null };
type TrackedOrder = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  createdAt: string;
  totalAmount: number;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  city: string;
  canCancel?: boolean;
  trackingNumber?: string | null;
  products: TrackedProduct[];
  tracking?: { timeline: TrackingEvent[]; trackingNumber: string | null; sellers?: Array<{ shopOrderNumber: string; orderStatus: string; pickupStatus: string | null; trackingNumber: string | null }> };
};
type LookupError = { kind: "invalid" | "notFound" | "signin" | "network"; message: string };

const STAGES: { key: string; label: string; icon: Icon }[] = [
  { key: "placed", label: "Order Placed", icon: ClipboardList },
  { key: "confirmed", label: "Confirmed", icon: PackageCheck },
  { key: "packed", label: "Packed", icon: Package },
  { key: "pickup_scheduled", label: "Pickup Scheduled", icon: ClipboardList },
  { key: "collected", label: "Collected by Courier", icon: Bike },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: House },
];

// There is no separate "out for delivery" status, so stage 5 is only complete once delivered.
const STAGE_OF: Record<string, number> = { pending: 0, placed: 0, confirmed: 1, processing: 1, packing: 2, packed: 2, shipped: 5, delivered: 6 };

const EVENT_COPY: Record<TrackingStatus, { title: string; text: string; icon: Icon }> = {
  placed: { title: "Order Placed", text: "Your order has been received successfully.", icon: ClipboardList },
  confirmed: { title: "Order Confirmed", text: "Your order has been confirmed and is being prepared.", icon: PackageCheck },
  processing: { title: "Processing", text: "Your order is being processed.", icon: PackageCheck },
  packed: { title: "Packed", text: "Your items have been packed.", icon: Package },
  pickup_scheduled: { title: "Pickup Scheduled", text: "A courier pickup has been scheduled.", icon: ClipboardList },
  collected: { title: "Collected by Courier", text: "The parcel has been collected.", icon: Bike },
  shipped: { title: "Shipped", text: "Your order has been handed to the courier.", icon: Truck },
  delivered: { title: "Delivered", text: "Your order has been delivered.", icon: House },
  cancelled: { title: "Order Cancelled", text: "This order was cancelled.", icon: Ban },
};
const UPCOMING_COPY: Record<string, string> = {
  confirmed: "We'll confirm your order shortly.",
  packed: "Your items will be packed for dispatch.",
  pickup_scheduled: "A pickup will be scheduled.",
  collected: "A courier will collect your parcel.",
  shipped: "Your order will be handed to the courier.",
  delivered: "Your order will be delivered to you.",
};
const STATUS_BADGE: Record<string, string> = {
  pending: "Order Placed", confirmed: "Confirmed", processing: "Processing", packing: "Packed", packed: "Packed",
  shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
};

const ORDER_REF = /^(?:IR[BV]-\d{1,12}|c[a-z0-9]{20,40})$/i;

function normalizeRef(raw: string) {
  const value = raw.trim();
  return /^ir[bv]-/i.test(value) ? value.toUpperCase() : value;
}

function formatDateTime(iso: string, withYear = true) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}) });
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${day}, ${time}`;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return phone;
  return `${digits.slice(0, 4)}-•••${digits.slice(-4)}`;
}

function paymentLabel(method: string) {
  if (method === "cod") return "Cash on Delivery";
  if (method === "bank_transfer") return "Bank Transfer";
  return method.replaceAll("_", " ");
}

function HeroBoxes() {
  return (
    <svg viewBox="0 0 260 190" aria-hidden="true" className="h-full w-full">
      <path d="M150 28c40 0 70 22 92 60" fill="none" stroke="#7CC243" strokeWidth="2.5" strokeDasharray="6 7" strokeLinecap="round" />
      <ellipse cx="120" cy="178" rx="118" ry="10" fill="#CFE8BC" opacity=".6" />
      <path d="M20 120l56-14 50 14v52l-50 12-56-12z" fill="#D9A866" />
      <path d="M20 120l56 12v52l-56-12z" fill="#C48E4C" />
      <path d="M76 132l50-12v52l-50 12z" fill="#E3B677" />
      <path d="M20 120l56-14 50 14-50 12z" fill="#EBC58D" />
      <path d="M86 70l52-12 46 12v58l-46 12-52-12z" fill="#D9A866" />
      <path d="M86 70l52 12v58l-52-12z" fill="#C48E4C" />
      <path d="M138 82l46-12v58l-46 12z" fill="#E3B677" />
      <path d="M86 70l52-12 46 12-46 12z" fill="#EBC58D" />
      <text x="96" y="110" fill="#00543D" fontSize="15" fontWeight="800" fontFamily="system-ui, sans-serif" transform="rotate(12 96 110)">JORO</text>
      <path d="M38 160c-10-18-2-34 10-40 4 14 2 28-10 40zM180 170c4-20 18-30 32-30-4 14-14 26-32 30zM10 172c2-14 10-22 22-24-2 12-10 20-22 24z" fill="#5FAE3A" />
      <path d="M150 6c-11 0-20 9-20 20 0 15 20 34 20 34s20-19 20-34c0-11-9-20-20-20z" fill="#2E9E4A" />
      <circle cx="150" cy="26" r="7" fill="#fff" />
    </svg>
  );
}

function HeroTruck() {
  return (
    <svg viewBox="0 0 280 190" aria-hidden="true" className="h-full w-full">
      <path d="M0 176c70-24 170-30 280-22v36H0z" fill="#9AA5A0" opacity=".35" />
      <path d="M10 180c80-18 170-22 260-16" stroke="#fff" strokeWidth="3" strokeDasharray="14 12" fill="none" />
      <rect x="70" y="78" width="120" height="70" rx="6" fill="#1F8A3B" />
      <rect x="70" y="78" width="120" height="12" rx="4" fill="#26A047" />
      <text x="96" y="122" fill="#fff" fontSize="20" fontWeight="800" fontFamily="system-ui, sans-serif">JORO</text>
      <path d="M190 96h34l22 28v24h-56z" fill="#26A047" />
      <path d="M198 102h22l15 20h-37z" fill="#DFF3F9" />
      <rect x="62" y="146" width="186" height="8" rx="3" fill="#145F2A" />
      <circle cx="100" cy="156" r="13" fill="#263238" /><circle cx="100" cy="156" r="5" fill="#B0BEC5" />
      <circle cx="218" cy="156" r="13" fill="#263238" /><circle cx="218" cy="156" r="5" fill="#B0BEC5" />
      <path d="M232 20c-11 0-20 9-20 20 0 15 20 34 20 34s20-19 20-34c0-11-9-20-20-20z" fill="#2E9E4A" />
      <circle cx="232" cy="40" r="7" fill="#fff" />
      <path d="M40 92c-8 0-14 6-14 14 0 10 14 24 14 24s14-14 14-24c0-8-6-14-14-14z" fill="#E5484D" />
      <circle cx="40" cy="106" r="5" fill="#fff" />
    </svg>
  );
}

function Skyline() {
  return (
    <svg viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true" className="h-full w-full">
      <path
        fill="#CFE8BC"
        d="M0 120V78h40V52h28v26h22V40h34v38h26V60h30v18h40V30h24v48h30V56h36v22h26V46h28v32h44V64h26v14h36V36h30v42h24V58h34v20h40V44h22v34h30V62h28v16h44V28h26v50h34V54h32v24h28V48h36v30h40V66h30v12h34V40h28v38h36V58h30v20h24V36h32v42h40V60h34v18h30V46h28v32h40v42z"
      />
    </svg>
  );
}

function DetailRow({ icon: IconCmp, label, children }: { icon: Icon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 border-t border-[#EEF1EE] py-3.5 first:border-t-0 first:pt-0">
      <IconCmp className="mt-0.5 h-5 w-5 shrink-0 text-[#00543D]" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-[13px] text-[#6B7280]">{label}</p>
        <div className="break-words text-sm font-medium text-[#172033] sm:text-[15px]">{children}</div>
      </div>
    </div>
  );
}

export default function TrackOrderPage() {
  const searchParams = useSearchParams();
  const { isCustomer, authLoading, openAuthModal } = useCustomerAuth();
  const [num, setNum] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<LookupError | null>(null);
  const [loading, setLoading] = useState(false);
  const [myOrders, setMyOrders] = useState<{ orderNumber: string; orderStatus: string }[]>([]);
  const [wa, setWa] = useState("923001234567");
  const lastLookup = useRef("");
  const requestId = useRef(0);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => s.whatsappNumber && setWa(s.whatsappNumber))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isCustomer) return;
    fetch("/api/orders/mine")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.orders)) {
          setMyOrders(data.orders.map((o: Record<string, unknown>) => ({ orderNumber: String(o.orderNumber || ""), orderStatus: String(o.orderStatus || "pending") })).filter((o: { orderNumber: string }) => o.orderNumber));
        }
      })
      .catch(() => {});
  }, [isCustomer]);

  const lookupByNumber = useCallback(async (raw: string) => {
    const ref = normalizeRef(raw);
    if (!ref) {
      setError({ kind: "invalid", message: "Please enter your order number." });
      return;
    }
    if (!ORDER_REF.test(ref)) {
      setError({ kind: "invalid", message: "That doesn't look like a JORO order number. It should look like IRB-045." });
      return;
    }
    // Keep the order in the URL so refresh and shared links reopen the same lookup.
    if (searchParams?.get("order") !== ref) window.history.replaceState(null, "", `/track-order?order=${encodeURIComponent(ref)}`);
    lastLookup.current = ref;
    if (!isCustomer) {
      setOrder(null);
      setError({ kind: "signin", message: `Sign in with the account used to place ${ref} to see its tracking details.` });
      return;
    }
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(ref)}`);
      const data = await res.json().catch(() => ({}));
      if (current !== requestId.current) return;
      if (res.status === 404) {
        setOrder(null);
        setError({ kind: "notFound", message: `We couldn't find order ${ref} on your account. Check the number and try again.` });
        return;
      }
      if (!res.ok) {
        setOrder(null);
        setError({ kind: "network", message: data.error || "Something went wrong while loading your order. Please try again." });
        return;
      }
      setOrder(data as TrackedOrder);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch {
      if (current !== requestId.current) return;
      setOrder(null);
      setError({ kind: "network", message: "We couldn't connect. Check your internet connection and try again." });
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [isCustomer, searchParams]);

  useEffect(() => {
    if (authLoading) return;
    const initialOrder = searchParams?.get("order");
    if (!initialOrder || normalizeRef(initialOrder) === lastLookup.current) return;
    setNum(initialOrder);
    void lookupByNumber(initialOrder);
  }, [authLoading, lookupByNumber, searchParams]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    await lookupByNumber(num);
  }

  async function cancelOrder() {
    if (!order) return;
    const id = String(order.orderNumber || order.id);
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not cancel order");
      return;
    }
    toast.success("Order cancelled");
    await lookupByNumber(id);
  }

  const status = order ? order.orderStatus.toLowerCase() : "";
  const cancelled = status === "cancelled";
  const timeline = order?.tracking?.timeline ?? [];
  const stageIndex = Math.max(STAGE_OF[status] ?? 0, ...timeline.map(event => STAGES.findIndex(stage => stage.key === event.status)));
  const stageTime = (key: string) => timeline.find((event) => event.status === key || (key === "confirmed" && event.status === "processing"))?.at;
  const trackingNumber = order?.tracking?.trackingNumber ?? order?.trackingNumber ?? null;
  const firstProduct = order?.products[0];
  const totalQty = order?.products.reduce((sum, p) => sum + p.quantity, 0) ?? 0;
  const blockedMsg = order && ["packing", "packed", "shipped", "delivered"].includes(status);

  return (
    <div className="min-h-screen bg-[#F7F8F2] text-[#172033]">
      <section className="relative overflow-hidden bg-gradient-to-b from-[#E6F4DC] via-[#F1F8EA] to-[#F7F8F2]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-32 opacity-70 sm:block">
          <Skyline />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute left-4 bottom-6 hidden h-[220px] w-[300px] min-[1360px]:block">
          <HeroBoxes />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute right-4 bottom-4 hidden h-[220px] w-[320px] min-[1360px]:block">
          <HeroTruck />
        </div>

        <div className="relative mx-auto max-w-[1200px] px-4 pb-10 pt-4 sm:px-6 sm:pb-12 sm:pt-5 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#00543D] hover:bg-white/60">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span>Back to shop</span>
            </Link>
            {isCustomer ? (
              <Link href="/account?tab=orders" className="rounded-lg px-2 py-1.5 text-sm font-semibold text-[#00543D] hover:bg-white/60">My orders</Link>
            ) : !authLoading ? (
              <button type="button" onClick={() => void openAuthModal("login")} className="rounded-lg px-2 py-1.5 text-sm font-semibold text-[#00543D] hover:bg-white/60">Sign in</button>
            ) : null}
          </div>

          <header className="mt-3 flex flex-col items-center text-center">
            <div className="flex items-center gap-3 sm:gap-4">
              <LogoMark />
              <span aria-hidden="true" className="h-9 w-px bg-[#00543D]/20" />
              <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] text-[#00543D] sm:text-xs">
                <Truck aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" />
                ORDER TRACKING
              </span>
            </div>
            <h1 className="mt-4 text-[32px] font-extrabold leading-tight tracking-tight text-[#0F2A1F] sm:text-5xl lg:text-[56px]">
              Track Your <span className="text-[#6DBE1F]">Order</span>
            </h1>
            <p className="mt-2 text-sm text-[#4B5563] sm:text-lg">Get real-time updates on your delivery journey.</p>
          </header>

          <LoadingForm
            noValidate
            onSubmit={lookup}
            className="relative mx-auto mt-6 max-w-[820px] rounded-2xl border border-white bg-white p-4 shadow-[0_10px_30px_-12px_rgba(0,84,61,0.25)] sm:mt-8 sm:p-5"
          >
            <div className="flex items-start gap-4">
              <span aria-hidden="true" className="mt-6 hidden h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F3F6F3] text-[#172033] sm:flex">
                <Box className="h-7 w-7" strokeWidth={1.5} />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor="track-order-number" className="mb-1.5 block text-sm font-medium text-[#374151]">Enter Order Number</label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="track-order-number"
                    value={num}
                    onChange={(e) => { setNum(e.target.value); if (error?.kind === "invalid") setError(null); }}
                    placeholder="e.g. IRB-045"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={48}
                    aria-invalid={error?.kind === "invalid" || undefined}
                    aria-describedby="track-order-help"
                    className={`h-12 w-full min-w-0 rounded-xl border bg-white px-4 sm:flex-1 text-base text-[#172033] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 ${
                      error?.kind === "invalid" ? "border-red-500 focus:ring-red-100" : "border-[#E5E9E5] focus:border-[#00543D] focus:ring-[#A8E52E]/40"
                    }`}
                  />
                  <LoadingButton
                    type="submit"
                    loading={loading}
                    loadingLabel="Tracking…"
                    className="h-12 shrink-0 rounded-xl bg-[#00543D] px-7 text-base font-semibold text-white transition hover:bg-[#003F2E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A8E52E]/50 disabled:opacity-60 sm:min-w-[190px]"
                  >
                    <span className="inline-flex items-center justify-center gap-2.5">
                      <Search aria-hidden="true" className="h-5 w-5" />
                      Track Order
                    </span>
                  </LoadingButton>
                </div>
                <p id="track-order-help" aria-live="polite" className={`mt-2 text-[13px] ${error?.kind === "invalid" ? "text-red-600" : "text-[#6B7280]"}`}>
                  {error?.kind === "invalid" ? error.message : "Enter your order number (e.g. IRB-045) to view live tracking details."}
                </p>
                {myOrders.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-[#6B7280]">Your recent orders:</span>
                    {myOrders.slice(0, 5).map((o) => (
                      <button
                        key={o.orderNumber}
                        type="button"
                        onClick={() => { setNum(o.orderNumber); void lookupByNumber(o.orderNumber); }}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          order?.orderNumber === o.orderNumber ? "border-[#00543D] bg-[#00543D] text-white" : "border-[#D9EFB5] bg-[#F3FAE6] text-[#00543D] hover:border-[#7CC243]"
                        }`}
                      >
                        {o.orderNumber}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </LoadingForm>
        </div>
      </section>

      <div ref={resultRef} className="mx-auto max-w-[1200px] scroll-mt-4 px-4 pb-14 pt-6 sm:px-6 lg:px-8">
        {error && error.kind !== "invalid" && (
          <div role="alert" className={`mx-auto mb-6 flex max-w-[820px] flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center ${error.kind === "signin" ? "border-[#D9EFB5]" : "border-[#F3D9D9]"}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${error.kind === "signin" ? "bg-[#F3FAE6] text-[#00543D]" : "bg-red-50 text-red-600"}`}>
              {error.kind === "signin" ? <LogIn aria-hidden="true" className="h-5 w-5" /> : <CircleAlert aria-hidden="true" className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{error.kind === "signin" ? "Sign in to track this order" : error.kind === "notFound" ? "Order not found" : "Couldn't load your order"}</p>
              <p className="mt-0.5 text-sm text-[#4B5563]">{error.message}</p>
            </div>
            {error.kind === "signin" ? (
              <button type="button" onClick={() => void openAuthModal("login")} className="h-11 shrink-0 rounded-xl bg-[#00543D] px-5 text-sm font-semibold text-white hover:bg-[#003F2E]">Sign in</button>
            ) : error.kind === "network" ? (
              <LoadingButton type="button" onClick={() => lookupByNumber(num)} className="h-11 shrink-0 rounded-xl border border-[#E5E9E5] px-5 text-sm font-semibold hover:bg-[#F7F8F2]">Try again</LoadingButton>
            ) : null}
          </div>
        )}

        {loading && !order && (
          <div aria-label="Loading order details" className="grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="h-[420px] rounded-2xl bg-white" />
            <div className="h-[420px] rounded-2xl bg-white" />
          </div>
        )}

        {!order && !loading && !error && (
          <div className="mx-auto flex max-w-[820px] flex-col items-center gap-2 rounded-2xl border border-dashed border-[#D9E5D9] bg-white/70 px-5 py-8 text-center">
            <Truck aria-hidden="true" className="h-8 w-8 text-[#7CC243]" strokeWidth={1.5} />
            <p className="font-semibold">Your tracking details will appear here</p>
            <p className="max-w-md text-sm text-[#6B7280]">
              You&apos;ll find your order number in your confirmation email or under{" "}
              <Link href="/account?tab=orders" className="font-semibold text-[#00543D] underline underline-offset-2">My orders</Link>.
            </p>
          </div>
        )}

        {order && (
          <div className={`grid items-start gap-5 transition-opacity sm:gap-6 lg:grid-cols-[minmax(0,1fr)_380px] ${loading ? "opacity-60" : ""}`}>
            <article className="min-w-0 rounded-2xl border border-[#E5E9E5] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#E5E9E5] bg-[#F3F4F3] sm:h-[100px] sm:w-[100px]">
                    {firstProduct?.image ? (
                      <Image src={firstProduct.image} alt={firstProduct.name} fill sizes="100px" unoptimized className="object-cover" />
                    ) : (
                      <Package aria-hidden="true" className="absolute inset-0 m-auto h-8 w-8 text-[#9CA3AF]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="break-words text-xl font-bold leading-tight sm:text-2xl">Order #{order.orderNumber}</h2>
                    <p className="mt-1 text-sm text-[#6B7280] sm:text-[15px]">Placed on {formatDateTime(order.createdAt)}</p>
                    {firstProduct && (
                      <p className="mt-2 line-clamp-2 break-words text-sm font-medium sm:text-base">
                        {firstProduct.name}
                        {order.products.length > 1 && <span className="font-normal text-[#6B7280]"> + {order.products.length - 1} more item{order.products.length > 2 ? "s" : ""}</span>}
                      </p>
                    )}
                    <p className="mt-0.5 text-sm text-[#6B7280] sm:text-[15px]">
                      Qty: {totalQty} <span aria-hidden="true" className="mx-1.5">|</span> {formatPKR(order.totalAmount)}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-2 self-start rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                    cancelled ? "bg-red-50 text-red-700" : "bg-[#EAF6DA] text-[#00543D]"
                  }`}
                >
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${cancelled ? "bg-red-600" : "bg-[#2E9E4A]"}`} />
                  {STATUS_BADGE[status] || status}
                </span>
              </div>

              {cancelled ? (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
                  <Ban aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>This order has been cancelled, so it won&apos;t be delivered. If you were charged, any refund follows our return policy.</p>
                </div>
              ) : (
                <div className="mt-7">
                  <ol aria-label="Delivery progress" className="grid grid-cols-7">
                    {STAGES.map((stage, index) => {
                      const done = !!stageTime(stage.key) && (index < stageIndex || status === "delivered");
                      const current = index === stageIndex && status !== "delivered";
                      const at = stageTime(stage.key) ?? (stage.key === "placed" ? order.createdAt : undefined);
                      const StageIcon = stage.icon;
                      return (
                        <li key={stage.key} aria-current={current ? "step" : undefined} className="relative flex min-w-0 flex-col items-center text-center">
                          {index > 0 && (
                            <span aria-hidden="true" className={`absolute right-1/2 top-4 h-1 w-full -translate-y-1/2 sm:top-[22px] ${done ? "bg-[#00543D]" : "border-t-2 border-dashed border-[#D9DED9] bg-transparent"}`} />
                          )}
                          <span
                            className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full sm:h-11 sm:w-11 ${
                              done
                                ? "bg-[#00543D] text-white"
                                : current
                                  ? "bg-[#2E9E4A] text-white ring-4 ring-[#A8E52E]/40"
                                  : "border-2 border-[#D9DED9] bg-white text-[#6B7280]"
                            }`}
                          >
                            {done ? <Check aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={3} /> : <StageIcon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.75} />}
                          </span>
                          <span className={`mt-2 hidden text-xs font-semibold leading-tight sm:block md:text-sm ${done || current ? "text-[#172033]" : "text-[#4B5563]"}`}>{stage.label}</span>
                          <span className="sr-only sm:hidden">{stage.label}</span>
                          <span className="sr-only">{done ? " (complete)" : current ? " (current)" : " (upcoming)"}</span>
                          {at && index <= stageIndex && <span className="mt-0.5 hidden text-[11px] text-[#6B7280] sm:block md:text-xs">{formatDateTime(at, false)}</span>}
                        </li>
                      );
                    })}
                  </ol>
                  <p className="mt-3 text-center text-sm font-semibold text-[#00543D] sm:hidden">
                    {status === "delivered" ? "Delivered" : `Step ${stageIndex + 1} of ${STAGES.length}: ${STAGES[stageIndex]?.label}`}
                  </p>
                </div>
              )}

              <h3 className="mt-8 text-lg font-bold sm:text-xl">Tracking Timeline</h3>
              <ol className="mt-4">
                {[...timeline].reverse().map((event, index) => {
                  const copy = EVENT_COPY[event.status];
                  const EventIcon = copy.icon;
                  const latest = index === 0;
                  const lastItem = index === timeline.length - 1 && (cancelled || stageIndex >= STAGES.length - 1);
                  return (
                    <li key={`${event.status}-${event.at}`} className={`relative flex gap-4 ${lastItem ? "" : "pb-6"}`}>
                      {!lastItem && <span aria-hidden="true" className="absolute bottom-0 left-5 top-10 w-0.5 -translate-x-1/2 bg-[#D9E5D9]" />}
                      <span
                        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          event.status === "cancelled" ? "bg-red-50 text-red-600" : latest ? "bg-[#2E9E4A] text-white ring-4 ring-[#A8E52E]/35" : "bg-[#EAF6DA] text-[#00543D]"
                        }`}
                      >
                        <EventIcon className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="font-semibold">{copy.title}</p>
                        <p className="text-sm text-[#4B5563]">{copy.text}</p>
                        <p className="mt-0.5 text-[13px] text-[#6B7280]">{formatDateTime(event.at)}</p>
                      </div>
                    </li>
                  );
                })}
                {!cancelled &&
                  STAGES.slice(stageIndex + 1).map((stage, index, rest) => {
                    const StageIcon = stage.icon;
                    return (
                      <li key={stage.key} className="relative flex gap-4 pb-6 last:pb-0">
                        {index < rest.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-5 top-10 w-0.5 -translate-x-1/2 bg-[#E5E9E5]" />}
                        <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F4F3] text-[#9CA3AF]">
                          <StageIcon className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0 pt-0.5">
                          <p className="font-semibold text-[#4B5563]">{stage.label}</p>
                          <p className="text-sm text-[#6B7280]">{UPCOMING_COPY[stage.key]}</p>
                        </div>
                      </li>
                    );
                  })}
              </ol>

              {order.tracking?.sellers && order.tracking.sellers.length > 1 ? <section className="mt-6 rounded-xl border border-[#D9E5D9] bg-white p-4"><h3 className="font-bold text-[#00543D]">Seller fulfilment</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{order.tracking.sellers.map(seller => <div key={seller.shopOrderNumber} className="rounded-lg bg-[#F5F8F2] p-3 text-sm"><p className="font-semibold">{seller.shopOrderNumber}</p><p>Order: {STATUS_BADGE[seller.orderStatus] || seller.orderStatus}</p>{seller.pickupStatus && seller.orderStatus === "packed" ? <p>Pickup: {seller.pickupStatus.replaceAll("_", " ")}</p> : null}{seller.trackingNumber ? <p>Tracking: {seller.trackingNumber}</p> : null}</div>)}</div></section> : null}

              {status === "delivered" ? (
                <div className="mt-6">
                  <RateYourProductsSection
                    parentOrderId={String(order.id || "").trim()}
                    lines={order.products as unknown as RateProductLine[]}
                  />
                </div>
              ) : null}

              {order.canCancel ? (
                <LoadingButton
                  type="button"
                  onClick={cancelOrder}
                  className="mt-6 w-full rounded-xl border-2 border-red-300 py-2.5 font-semibold text-red-600 hover:bg-red-50"
                >
                  Cancel order
                </LoadingButton>
              ) : blockedMsg && status !== "delivered" ? (
                <p className="mt-6 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  This order is already being packed and can no longer be cancelled.
                </p>
              ) : null}
            </article>

            <aside className="min-w-0 space-y-5 sm:space-y-6">
              <section className="rounded-2xl border border-[#E5E9E5] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)] sm:p-6">
                <h2 className="mb-4 flex items-center gap-2.5 text-lg font-bold">
                  <Truck aria-hidden="true" className="h-6 w-6 text-[#00543D]" strokeWidth={1.75} />
                  Delivery Details
                </h2>
                <DetailRow icon={User} label="Recipient">{order.customerName}</DetailRow>
                {order.customerPhone && <DetailRow icon={Phone} label="Phone">{maskPhone(order.customerPhone)}</DetailRow>}
                <DetailRow icon={MapPin} label="Delivery Address">
                  {[order.customerAddress, order.city].filter(Boolean).join(", ")}
                </DetailRow>
                <DetailRow icon={CreditCard} label="Payment">
                  {paymentLabel(order.paymentMethod)}
                  {order.paymentMethod === "cod" && !cancelled && status !== "delivered" && (
                    <span className="block text-[13px] font-normal text-[#6B7280]">Pay {formatPKR(order.totalAmount)} when you receive your order</span>
                  )}
                </DetailRow>
                <DetailRow icon={Tag} label="Tracking ID">
                  {trackingNumber ? (
                    <span className="font-semibold tracking-wide">{trackingNumber}</span>
                  ) : (
                    <span className="font-normal text-[#6B7280]">Shared once your order ships</span>
                  )}
                </DetailRow>
              </section>

              <section className="rounded-2xl border border-[#D9EFB5] bg-[#F3FAE6] p-4 sm:p-5">
                <h2 className="flex items-center gap-2 font-semibold text-[#00543D]">
                  <MapPin aria-hidden="true" className="h-5 w-5" />
                  Shipment Information
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#374151]">
                  {cancelled
                    ? "This shipment was cancelled and won't be dispatched."
                    : status === "delivered"
                      ? "Your parcel has been delivered. We hope you enjoy your order!"
                      : stageIndex >= 3
                        ? trackingNumber
                          ? `Your parcel is with the courier. Quote tracking ID ${trackingNumber} to the courier for live location updates.`
                          : "Your parcel is with the courier. We'll add the tracking ID here as soon as we receive it."
                        : "Live courier location isn't available yet. We'll update this page and notify you as soon as your order ships."}
                </p>
              </section>

              <section className="flex flex-col gap-4 rounded-2xl border border-[#E5E9E5] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)] sm:flex-row sm:items-center sm:p-5 lg:flex-col lg:items-stretch">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#4CAF50] text-white">
                    <Headset className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold">Need Help?</h2>
                    <p className="text-[13px] leading-snug text-[#6B7280]">Our support team is here to help with any questions about your order.</p>
                  </div>
                </div>
                <Link
                  href={`/account/help/new?resourceType=ORDER&resourceId=${encodeURIComponent(order.id)}`}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#EAF6DA] px-4 text-sm font-semibold text-[#00543D] transition hover:bg-[#DDF0C4]"
                >
                  <MessageCircle aria-hidden="true" className="h-4 w-4" />
                  Contact Support
                </Link>
              </section>
              <WhatsAppButton number={wa} label="Chat with us on WhatsApp" className="w-full justify-center rounded-xl" />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
