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
  ArrowLeft, ArrowRight, Ban, Bike, Box, Check, CircleAlert, ClipboardList, CreditCard, FileText, Headset, House, LogIn,
  MapPin, MessageCircle, Package, PackageCheck, Phone, Search, ShieldCheck, Tag, Truck, User, Zap, type LucideIcon,
} from "lucide-react";

type Icon = LucideIcon;

type TrackedProduct = { id: string; productId?: string | null; name: string; price: number; quantity: number; image?: string; variant?: string | null };
type TrackedOrder = {
  fulfillmentType?: "SERVICE" | "PHYSICAL";
  serviceStatus?: string;
  paymentStatus?: string;
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

const BENEFITS: { icon: Icon; label: string }[] = [
  { icon: Zap, label: "Real-time Tracking" },
  { icon: ShieldCheck, label: "Safe & Secure Delivery" },
  { icon: MapPin, label: "From Our Store to Your Door" },
];

// Illustrations are small WebP files served as-is (the production image optimizer cannot read new public files).
const PARCEL = { src: "/images/order-tracking/tracking-parcel-map.webp", width: 720, height: 635 };
const VAN = { src: "/images/order-tracking/tracking-delivery-van.webp", width: 900, height: 551 };

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

  if (order?.fulfillmentType === "SERVICE") return <main className="mx-auto max-w-3xl space-y-4 px-4 py-10"><h1 className="text-2xl font-bold">Service order {order.orderNumber}</h1><p>Service: {order.serviceStatus || order.orderStatus}</p><p>Payment: {order.paymentStatus || "pending"}</p><p>{order.customerAddress}, {order.city}</p><p className="font-bold">Total: {formatPKR(order.totalAmount)}</p><Link href="/account/services" className="inline-block rounded-xl bg-brand-primary px-5 py-3 font-bold">Scheduling &amp; service history</Link><Link href={`/account/orders/${order.id}`} className="block font-bold text-brand-link underline">Order details and support</Link></main>;

  return (
    <div className="min-h-screen bg-[#F5F9EF] text-[#102D25]">
      <section className="relative overflow-hidden">
        {/* The hero background stops part-way down the tracking card, so the card overlaps it. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bottom-24 overflow-hidden rounded-b-[32px] bg-gradient-to-b from-[#FBFDF6] via-[#F1F8E7] to-[#E4F1D5] sm:bottom-28 sm:rounded-b-[48px]">
          <div className="absolute -left-24 top-28 h-72 w-72 rounded-full bg-[#D8EEC0]/60 blur-3xl" />
          <div className="absolute -right-24 top-6 h-80 w-80 rounded-full bg-[#E2F3CC]/80 blur-3xl" />
          <div className="absolute left-1/2 top-40 h-64 w-[38rem] -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 mx-auto hidden h-full max-w-[1440px] xl:block">
            <Image src={PARCEL.src} alt="" width={PARCEL.width} height={PARCEL.height} unoptimized priority className="absolute bottom-2 left-0 h-auto w-[290px] drop-shadow-[0_18px_24px_rgba(0,75,59,0.16)] 2xl:left-2 2xl:w-[320px]" />
            <Image src={VAN.src} alt="" width={VAN.width} height={VAN.height} unoptimized priority className="absolute bottom-0 right-0 h-auto w-[380px] drop-shadow-[0_18px_24px_rgba(0,75,59,0.14)] 2xl:w-[420px]" />
          </div>
        </div>

        <div className="relative mx-auto max-w-[1200px] px-4 pb-2 pt-4 sm:px-6 sm:pt-6 lg:px-8">
          <nav aria-label="Order tracking" className="grid grid-cols-[1fr_auto] items-center gap-y-3 sm:grid-cols-[1fr_auto_1fr]">
            <Link href="/" className="inline-flex items-center gap-1.5 justify-self-start rounded-lg px-2 py-1.5 text-sm font-semibold text-[#005B46] transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#76C900]">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span>Back to shop</span>
            </Link>
            <div className="col-span-2 row-start-2 flex items-center justify-center gap-3 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:gap-4">
              <LogoMark />
              <span aria-hidden="true" className="h-9 w-px bg-[#005B46]/20" />
              <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold tracking-[0.2em] text-[#005B46] sm:text-xs">
                <Truck aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" />
                ORDER TRACKING
              </span>
            </div>
            <div className="col-start-2 row-start-1 justify-self-end sm:col-start-3">
              {isCustomer ? (
                <Link href="/account?tab=orders" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#005B46] transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#76C900]">
                  <FileText aria-hidden="true" className="h-4 w-4" />
                  My orders
                </Link>
              ) : !authLoading ? (
                <button type="button" onClick={() => void openAuthModal("login")} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#005B46] transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#76C900]">
                  <LogIn aria-hidden="true" className="h-4 w-4" />
                  Sign in
                </button>
              ) : null}
            </div>
          </nav>

          <header className="mx-auto mt-6 flex max-w-[640px] flex-col items-center text-center sm:mt-8">
            <h1 className="text-[34px] font-extrabold leading-[1.08] tracking-tight text-[#102D25] min-[380px]:text-[38px] sm:text-[52px] lg:text-[60px]">
              Track Your <span className="text-[#6CBF00]">Order</span>
            </h1>
            <p className="mt-2.5 text-[15px] text-[#4E5D57] sm:mt-3 sm:text-lg">Get real-time updates on your delivery journey.</p>
            <ul className="mt-5 grid w-full grid-cols-3 gap-2 sm:mt-7 sm:flex sm:justify-center sm:gap-0 sm:divide-x sm:divide-[#D6E5CB]">
              {BENEFITS.map(({ icon: BenefitIcon, label }) => (
                <li key={label} className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:gap-3 sm:px-5 sm:text-left">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#4FAE0E] shadow-[0_4px_12px_-4px_rgba(0,75,59,0.18)] ring-1 ring-[#E4EDE1] sm:h-11 sm:w-11">
                    <BenefitIcon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="max-w-[112px] text-[12px] font-medium leading-snug text-[#102D25] sm:text-sm">{label}</span>
                </li>
              ))}
            </ul>
          </header>

          {/* Below 1280px the illustrations sit side by side above the form instead of beside the heading. */}
          <div aria-hidden="true" className="mx-auto mt-4 flex max-w-[560px] items-end justify-center gap-1 sm:mt-6 xl:hidden">
            <Image src={PARCEL.src} alt="" width={PARCEL.width} height={PARCEL.height} unoptimized className="h-auto w-[40%] drop-shadow-[0_12px_16px_rgba(0,75,59,0.14)]" />
            <Image src={VAN.src} alt="" width={VAN.width} height={VAN.height} unoptimized className="h-auto w-[58%] drop-shadow-[0_12px_16px_rgba(0,75,59,0.12)]" />
          </div>

          <LoadingForm
            noValidate
            onSubmit={lookup}
            className="relative mx-auto mt-3 max-w-[880px] rounded-[24px] border border-[#EEF3EA] bg-white p-4 shadow-[0_24px_60px_-28px_rgba(0,75,59,0.38)] sm:mt-4 sm:p-7 xl:mt-12"
          >
            <div className="flex items-start gap-5">
              <span aria-hidden="true" className="mt-7 hidden h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#EAF5DF] text-[#005B46] sm:flex">
                <Box className="h-7 w-7" strokeWidth={1.6} />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor="track-order-number" className="mb-2 block text-sm font-semibold text-[#102D25] sm:text-[15px]">Enter Order Number</label>
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
                    className={`h-12 w-full min-w-0 rounded-xl border bg-white px-4 text-base text-[#102D25] transition placeholder:text-[#94A3B8] focus:outline-none focus:ring-4 sm:h-14 sm:flex-1 ${
                      error?.kind === "invalid" ? "border-red-500 focus:ring-red-100" : "border-[#DCE6D8] hover:border-[#C3D8B8] focus:border-[#005B46] focus:ring-[#76C900]/20"
                    }`}
                  />
                  <LoadingButton
                    type="submit"
                    loading={loading}
                    loadingLabel="Tracking…"
                    className="group h-12 shrink-0 rounded-xl bg-[#005B46] px-6 text-base font-semibold text-white shadow-[0_10px_20px_-10px_rgba(0,91,70,0.7)] transition hover:bg-[#004B3B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#76C900]/50 disabled:opacity-60 sm:h-14 sm:min-w-[220px]"
                  >
                    <span className="inline-flex items-center justify-center gap-2.5">
                      <Search aria-hidden="true" className="h-5 w-5" />
                      Track Order
                      <ArrowRight aria-hidden="true" className="h-5 w-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                    </span>
                  </LoadingButton>
                </div>
                <p id="track-order-help" aria-live="polite" className={`mt-2 text-[13px] ${error?.kind === "invalid" ? "text-red-600" : "text-[#64748B]"}`}>
                  {error?.kind === "invalid" ? error.message : "Enter your order number (e.g. IRB-045) to view live tracking details."}
                </p>
                {myOrders.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-[13px] text-[#64748B]">Your recent orders:</span>
                    {myOrders.slice(0, 5).map((o) => (
                      <button
                        key={o.orderNumber}
                        type="button"
                        onClick={() => { setNum(o.orderNumber); void lookupByNumber(o.orderNumber); }}
                        aria-pressed={order?.orderNumber === o.orderNumber}
                        className={`min-h-8 rounded-full border px-3.5 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#76C900] focus-visible:ring-offset-1 ${
                          order?.orderNumber === o.orderNumber ? "border-[#005B46] bg-[#005B46] text-white" : "border-[#D3EBB8] bg-[#EAF5DF] text-[#005B46] hover:border-[#76C900] hover:bg-[#E1F1D0]"
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
          <div role="alert" className={`mx-auto mb-6 flex max-w-[880px] flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center ${error.kind === "signin" ? "border-[#D9EFB5]" : "border-[#F3D9D9]"}`}>
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
          <div className="mx-auto flex max-w-[880px] flex-col items-center rounded-[24px] border-2 border-dashed border-[#D7EAC6] bg-white/85 px-5 pb-8 pt-6 text-center sm:px-10 sm:pb-10 sm:pt-8">
            <Image src="/images/order-tracking/tracking-empty-state.webp" alt="" width={1000} height={309} unoptimized className="h-auto w-full max-w-[460px]" />
            <h2 className="mt-4 text-lg font-bold text-[#102D25] sm:mt-5 sm:text-[22px]">Your tracking details will appear here</h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#64748B] sm:text-[15px]">
              You&apos;ll find your order number in your confirmation email or under{" "}
              <Link href="/account?tab=orders" className="rounded font-semibold text-[#005B46] underline underline-offset-2 hover:text-[#004B3B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#76C900]">My orders</Link>.
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
