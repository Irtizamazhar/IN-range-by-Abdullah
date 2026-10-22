"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import toast from "react-hot-toast";
import { getSession, useSession } from "next-auth/react";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatPKR } from "@/lib/format";
import { normalizePakistanMobile, PAKISTAN_MOBILE_ERROR } from "@/lib/pakistan-phone";
import { PakistanCitySelect } from "@/components/ui/PakistanCitySelect";
import { WhatsAppButton } from "@/components/user/WhatsAppButton";
import type { ISettings } from "@/types/settings";
import {
  ArrowRight, Banknote, Building2, Check, ChevronDown, CircleAlert, CreditCard, FileText,
  Lock, Mail, Mailbox, MapPin, Phone, ShieldCheck, ShoppingCart, Tag, Truck, X,
} from "lucide-react";
import { readCheckoutReceipt, checkoutAttemptKey, clearCheckoutAttempt } from "@/lib/checkout-response";
type PaymentMethod = "cod";

type FieldKey = "email" | "firstName" | "address" | "city" | "phone" | "billingFirstName" | "billingAddress" | "billingCity";
// Top-to-bottom order, so the first invalid field gets focus.
const FIELD_ORDER: FieldKey[] = ["email", "firstName", "address", "city", "phone", "billingFirstName", "billingAddress", "billingCity"];
const fieldId = (key: FieldKey) => `checkout-${key}`;

const inputClass = (error?: string, extra = "") =>
  `h-12 w-full min-w-0 rounded-lg border bg-white px-3.5 text-base text-[#172033] placeholder:text-[#9CA3AF] transition focus:outline-none focus:ring-2 sm:h-11 sm:text-sm ${
    error ? "border-red-500 focus:border-red-500 focus:ring-red-100" : "border-[#E5E9E5] focus:border-[#00543D] focus:ring-[#A8E52E]/40"
  } ${extra}`;
const cityClass = (error?: string) =>
  `!h-12 !rounded-lg !pl-14 text-base text-[#172033] sm:!h-11 sm:text-sm ${
    error ? "!border-red-500 focus:!ring-red-100" : "!border-[#E5E9E5] focus:!border-[#00543D] focus:!ring-[#A8E52E]/40"
  }`;
const cardClass = "min-w-0 rounded-2xl border border-[#E5E9E5] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.06)] sm:p-6";

function PakistanFlag({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" aria-hidden="true" className={`shrink-0 rounded-[2px] ${className}`}>
      <rect width="30" height="20" fill="#01411C" />
      <rect width="7.5" height="20" fill="#fff" />
      <circle cx="18.75" cy="10" r="5.6" fill="#fff" />
      <circle cx="20.2" cy="8.9" r="4.9" fill="#01411C" />
      <polygon fill="#fff" points="22.67,5.83 22.35,7.13 23.42,7.94 22.09,8.03 21.65,9.30 21.15,8.06 19.81,8.04 20.83,7.17 20.44,5.90 21.58,6.60" />
    </svg>
  );
}

function SectionHeader({ step, icon: Icon, title, subtitle, action }: {
  step?: number; icon?: ComponentType<{ className?: string }>; title: string; subtitle?: string; action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      {step ? (
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00543D] text-base font-bold text-white">{step}</span>
      ) : Icon ? (
        <Icon aria-hidden="true" className="mt-0.5 h-7 w-7 shrink-0 text-[#00543D]" />
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold leading-tight text-[#172033] sm:text-xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Field({ id, label, optional, error, className = "", children }: {
  id: string; label: string; optional?: boolean; error?: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[#172033]">
        {label}
        {optional && <span className="font-normal text-[#6B7280]"> (optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-red-600">
          <CircleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

function IconBox({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative min-w-0">
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-px left-px z-10 flex w-11 items-center justify-center border-r border-[#E5E9E5] text-[#00543D]">
        {icon}
      </span>
      {children}
    </div>
  );
}

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const { isCustomer, authLoading, openAuthModal } = useCustomerAuth();
  const { data: session } = useSession();
  const [settings, setSettings] = useState<ISettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  const [loading, setLoading] = useState(false);
  const orderInFlight = useRef(false);
  const checkoutAttempt = useRef<{ signature: string; key: string } | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [couponTone, setCouponTone] = useState<"success" | "error" | "info">("info");
  const [couponBusy, setCouponBusy] = useState(false);
  const [handlingFee, setHandlingFee] = useState<number | null>(null);
  const [handlingFeeError, setHandlingFeeError] = useState("");
  const [handlingFeeVersion, setHandlingFeeVersion] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [apartment, setApartment] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Pakistan");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [saveInfoNextTime, setSaveInfoNextTime] = useState(false);
  const [sameBillingAddress, setSameBillingAddress] = useState(true);
  const [billingCountry, setBillingCountry] = useState("Pakistan");
  const [billingFirstName, setBillingFirstName] = useState("");
  const [billingLastName, setBillingLastName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingApartment, setBillingApartment] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingPostalCode, setBillingPostalCode] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const paymentMethod: PaymentMethod = "cod";

  const [doneOrder, setDoneOrder] = useState<{
    orderNumber: string;
    _id: string;
    customerPhone: string;
    totalAmount?: number;
    handlingFee?: number;
  } | null>(null);


  const loadSettings = useCallback(async (signal?: AbortSignal) => {
    setSettingsLoading(true);
    try {
      const response = await fetch("/api/settings", { signal });
      if (!response.ok) throw new Error("Could not load checkout options. Please try again.");
      const data = await response.json();
      if (!signal?.aborted) { setSettings(data); setSettingsError(""); }
    } catch (error) {
      if (!signal?.aborted) setSettingsError(error instanceof Error ? error.message : "Could not load checkout options. Please try again.");
    } finally { if (!signal?.aborted) setSettingsLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void loadSettings(controller.signal); return () => controller.abort(); }, [loadSettings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getSession();
      if (cancelled || s?.user?.role !== "customer") return;
      setEmail((prev) => prev || s.user?.email || "");
      if (!firstName.trim()) {
        const raw = (s.user?.name || "").trim();
        const parts = raw.split(/\s+/).filter(Boolean);
        if (parts.length > 0) {
          setFirstName(parts[0] || "");
          setLastName(parts.slice(1).join(" "));
        }
      }
      setPhone((prev) => prev || s.user?.phone || "");
    })().catch(() => { if (!cancelled) toast.error("Could not load account details. Please try again."); });
    return () => {
      cancelled = true;
    };
  }, [authLoading, firstName, isCustomer]);

  useEffect(() => {
    if (session?.user?.role !== "customer") return;
    setEmail((prev) => prev || session.user.email || "");
    if (!firstName.trim()) {
      const raw = (session.user.name || "").trim();
      const parts = raw.split(/\s+/).filter(Boolean);
      if (parts.length > 0) {
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" "));
      }
    }
    setPhone((prev) => prev || session.user.phone || "");
  }, [firstName, session]);

  useEffect(() => {
    if (!doneOrder?.orderNumber) return;
    try {
      const key = "recentOrderNumbers";
      const prev = JSON.parse(localStorage.getItem(key) || "[]") as string[];
      const next = [
        doneOrder.orderNumber,
        ...prev.filter((x) => x !== doneOrder.orderNumber),
      ].slice(0, 20);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Ignore localStorage errors
    }
  }, [doneOrder]);

  const customerFullName = useMemo(
    () => `${firstName} ${lastName}`.replace(/\s+/g, " ").trim(),
    [firstName, lastName]
  );

  const codAllowed =
    settings?.codAvailableCities?.some(
      (c) => c.toLowerCase() === city.trim().toLowerCase()
    ) ?? false;
  const deliveryCharge = items.length === 1 && items[0].quoteId ? Number(items[0].quoteShipping || 0) : Number(settings?.codCharges ?? 0);
  const productSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const serviceSubtotal = subtotal - productSubtotal;
  const totalAmount = subtotal + deliveryCharge - (appliedCoupon?.discount || 0);
  const cartSignature = JSON.stringify(items.map(i => [i.productId, i.quantity, i.price, i.variant, i.serviceId, i.quoteId]));
  useEffect(() => { setAppliedCoupon(null); setCouponMessage(""); }, [cartSignature]);

  // Server-calculated preview; POST /api/orders recalculates and rejects a mismatch.
  useEffect(() => {
    if (!isCustomer || items.length === 0) return;
    const controller = new AbortController();
    setHandlingFee(null);
    setHandlingFeeError("");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/checkout/handling-fee", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            quoteId: items.find(i => i.quoteId)?.quoteId,
            products: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || typeof data.handlingFee !== "number") throw new Error(data.error || "Could not calculate the handling fee.");
        setHandlingFee(data.handlingFee);
      } catch (error) {
        if (!controller.signal.aborted) setHandlingFeeError(error instanceof Error ? error.message : "Could not calculate the handling fee.");
      }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cartSignature captures the relevant item fields.
  }, [cartSignature, isCustomer, handlingFeeVersion]);

  async function applyCoupon() {
    setCouponBusy(true);
    setCouponMessage("");
    try {
      const response = await fetch("/api/coupons/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: couponInput, quoteId: items.find(i => i.quoteId)?.quoteId, products: items.map(i => ({ productId: i.productId, quantity: i.quantity })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Coupon could not be applied.");
      setAppliedCoupon({ code: data.code, discount: data.discount });
      setCouponMessage(`Coupon ${data.code} applied.`);
      setCouponTone("success");
    } catch (error) {
      setAppliedCoupon(null);
      setCouponMessage(error instanceof Error ? error.message : "Coupon could not be applied.");
      setCouponTone("error");
    } finally { setCouponBusy(false); }
  }

  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (!email.trim()) errors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email address.";
    if (!firstName.trim()) errors.firstName = "Enter your first name.";
    if (!address.trim()) errors.address = "Enter your street address.";
    if (!city.trim()) errors.city = "Select your city or town.";
    else if (!codAllowed) errors.city = `Cash on Delivery isn't available in ${city.trim()} yet. Please choose another city.`;
    if (!phone.trim()) errors.phone = "Enter your phone number.";
    else if (!normalizePakistanMobile(phone)) errors.phone = PAKISTAN_MOBILE_ERROR;
    if (!sameBillingAddress) {
      if (!billingFirstName.trim()) errors.billingFirstName = "Enter the billing first name.";
      if (!billingAddress.trim()) errors.billingAddress = "Enter the billing street address.";
      if (!billingCity.trim()) errors.billingCity = "Select the billing city or town.";
    }
    return errors;
  }, [email, firstName, address, city, codAllowed, phone, sameBillingAddress, billingFirstName, billingAddress, billingCity]);
  const touch = (key: FieldKey) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  const errorFor = (key: FieldKey) => (submitAttempted || touched[key] ? fieldErrors[key] : undefined);
  const describe = (key: FieldKey) => {
    const error = errorFor(key);
    return { id: fieldId(key), "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${fieldId(key)}-error` : undefined, onBlur: () => touch(key) };
  };

  async function placeOrder() {
    if (orderInFlight.current) return;
    orderInFlight.current = true;
    try {
      const s = await getSession();
      if (s?.user?.role !== "customer") {
        toast.error("Please sign in or create an account first");
        return openAuthModal("signup");
      }
      setLoading(true);
      const signature = JSON.stringify([s.user.id, cartSignature]);
      let storage: Storage | undefined;
      try { storage = window.sessionStorage; } catch { /* Private browsing may disable storage. */ }
      if (checkoutAttempt.current?.signature !== signature) checkoutAttempt.current = { signature, key: checkoutAttemptKey(signature, storage) };
      const requestKey = checkoutAttempt.current.key;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey,
        },
        body: JSON.stringify({
          customerName: customerFullName,
          customerPhone: phone,
          customerEmail: email,
          customerAddress: [address, apartment].filter(Boolean).join(", "),
          city,
          country, postalCode, sameBillingAddress,
          billingAddress: sameBillingAddress ? undefined : { name: [billingFirstName, billingLastName].filter(Boolean).join(" "), address: [billingAddress, billingApartment].filter(Boolean).join(", "), city: billingCity, country: billingCountry, postalCode: billingPostalCode, phone: billingPhone },
          paymentMethod,
          couponCode: appliedCoupon?.code,
          expectedHandlingFee: handlingFee ?? undefined,
          quoteId: items.find(i => i.quoteId)?.quoteId,
          products: items.map((i) => ({
            serviceId: i.serviceId,
            productId: i.productId,
            quantity: i.quantity,
            variant: i.variant,
          })),
        }),
      });
      let receipt;
      try { receipt = await readCheckoutReceipt(res); }
      catch (error) { if (res.status === 409) setHandlingFeeVersion(v => v + 1); throw error; }
      toast.success("Order placed successfully!");
      setDoneOrder(receipt);
      clearCheckoutAttempt(storage);
      clear();
    } catch (e) {
      toast.error(e instanceof TypeError ? "Connection interrupted. Your cart is saved. Please retry or check My Orders." : e instanceof Error ? e.message : "Checkout is temporarily unavailable. Please try again.");
    } finally {
      orderInFlight.current = false;
      setLoading(false);
    }
  }

  async function handleCheckoutSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (doneOrder) return;
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    const firstInvalid = FIELD_ORDER.find((key) => fieldErrors[key]);
    if (firstInvalid) {
      setSubmitAttempted(true);
      toast.error(firstInvalid === "city" && city.trim() && !codAllowed ? "Please check your selected city" : "Please review the highlighted fields.");
      const field = document.getElementById(fieldId(firstInvalid));
      field?.focus({ preventScroll: true });
      field?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    await placeOrder();
  }

  // Incomplete fields stay clickable so submit can point at what is missing.
  const placeOrderDisabled = loading || items.length === 0 || handlingFee === null;

  if (authLoading) return <PageSkeleton label="Loading checkout…" />;

  if (!isCustomer && !doneOrder) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-card border border-borderGray bg-white p-8 shadow-card">
          <p className="text-darkText mb-2 font-semibold">
            An account is required to check out
          </p>
          <p className="text-sm text-darkText/70 mb-6">
            Sign up or log in, then complete your order.
          </p>
          <LoadingButton
            type="button"
            onClick={() => openAuthModal("signup")}
            className="w-full rounded-xl bg-primaryYellow py-3 font-bold text-brand-dark mb-3"
          >
            Sign up / Login
          </LoadingButton>
          <Link href="/cart" className="text-primaryBlue text-sm font-medium">
            ← Back to cart
          </Link>
        </div>
      </div>
    );
  }

  if (settingsLoading && !settings && !settingsError) return <PageSkeleton label="Loading checkout options…" />;
  if (settingsError && !settings) return <main className="mx-auto max-w-xl px-4 py-12"><p role="alert">{settingsError}</p><LoadingButton onClick={() => loadSettings()} className="mt-4 rounded-xl bg-brand-primary px-5 py-3 font-bold">Try again</LoadingButton></main>;

  if (items.length === 0 && !doneOrder) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-darkText/70 mb-4">Your cart is empty.</p>
        <Link href="/products" className="text-primaryBlue font-bold">
          Browse products
        </Link>
      </div>
    );
  }

  if (doneOrder) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-card border border-borderGray bg-white p-8 shadow-card">
          <p className="mb-2 text-lg font-semibold text-green-600">Thank you!</p>
          <p className="mb-1 text-darkText">Your order number:</p>
          <p className="mb-6 text-2xl font-bold text-primaryBlue">
            {doneOrder.orderNumber}
          </p>
          {doneOrder.totalAmount != null && <div className="mb-6 rounded-xl bg-[#F3FAE6] px-4 py-3 text-sm text-[#00543D]"><p className="font-bold">Order total: {formatPKR(doneOrder.totalAmount)}</p>{doneOrder.handlingFee != null && doneOrder.handlingFee > 0 && <p className="mt-1">Includes Handling Fee: {formatPKR(doneOrder.handlingFee)}</p>}</div>}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LoadingButton
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(doneOrder.orderNumber);
                  toast.success("Tracking ID copied");
                } catch {
                  toast.error("Could not copy");
                }
              }}
              className="rounded-xl border border-borderGray py-2.5 text-sm font-semibold hover:bg-lightGray"
            >
              Copy tracking ID
            </LoadingButton>
            <Link
              href={`/track-order?order=${encodeURIComponent(doneOrder.orderNumber)}`}
              className="rounded-xl bg-brand-primary py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-hover"
            >
              Track this order
            </Link>
          </div>
          <WhatsAppButton
            number={settings?.whatsappNumber || "923001234567"}
            label="Contact us on WhatsApp"
            className="mb-4 w-full justify-center"
          />
          <Link
            href="/products"
            className="mb-4 block w-full rounded-xl bg-brand-primary py-3 text-center text-sm font-bold text-brand-dark hover:bg-brand-hover"
          >
            Continue shopping
          </Link>
          <Link href="/" className="inline-block font-medium text-primaryBlue">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const itemCountLabel = `${items.length} item${items.length === 1 ? "" : "s"} in your cart`;
  const formattedTotal = handlingFee === null ? null : formatPKR(totalAmount);

  return (
    <main className="min-w-0 overflow-x-clip bg-[#F7F8F2] pb-12 text-[#172033] sm:pb-16">
      <div className="mx-auto max-w-[1240px] px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <header className="mb-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="h-11 w-11 shrink-0 text-[#00543D] sm:h-12 sm:w-12" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight text-[#172033] sm:text-[28px]">Secure Checkout</h1>
              <p className="mt-0.5 text-sm text-[#6B7280] sm:text-base">Your information is safe and encrypted</p>
            </div>
          </div>
        </header>

        <LoadingForm
          noValidate
          onSubmit={handleCheckoutSubmit}
          className="grid items-start gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]"
        >
          <a
            href="#order-summary"
            className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#D9EFB5] bg-[#F3FAE6] px-4 py-3 text-sm lg:hidden"
          >
            <span className="flex min-w-0 items-center gap-2 font-semibold text-[#00543D]">
              <ShoppingCart aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="truncate">View order summary · {items.length} item{items.length === 1 ? "" : "s"}</span>
            </span>
            <span className="shrink-0 font-bold text-[#172033]">{formattedTotal ?? "…"}</span>
          </a>

          <div className="min-w-0 space-y-5 sm:space-y-6">
            <section className={cardClass}>
              <SectionHeader step={1} title="Contact Information" subtitle="We'll use this email to send you order updates" />
              <div className="space-y-4">
                <Field id={fieldId("email")} label="Email Address" error={errorFor("email")}>
                  <IconBox icon={<Mail className="h-4 w-4" />}>
                    <input
                      {...describe("email")}
                      type="email"
                      autoComplete="email"
                      aria-label="Email address"
                      className={inputClass(errorFor("email"), "pl-14")}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </IconBox>
                </Field>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#172033]">
                  <input
                    type="checkbox"
                    className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#00543D]"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                  />
                  Email me with news and offers
                </label>
              </div>
            </section>

            <section className={cardClass}>
              <SectionHeader step={2} title="Delivery Address" subtitle="Enter your delivery address for this order." />
              <div className="space-y-4">
                <Field id="checkout-country" label="Country">
                  <div className="relative min-w-0">
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-px left-px flex w-11 items-center justify-center border-r border-[#E5E9E5]">
                      <PakistanFlag className="h-3.5 w-5" />
                    </span>
                    <select
                      id="checkout-country"
                      aria-label="Delivery country"
                      autoComplete="country-name"
                      className={inputClass(undefined, "cursor-pointer appearance-none pl-14 pr-10")}
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      <option value="Pakistan">Pakistan</option>
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={fieldId("firstName")} label="First Name" error={errorFor("firstName")}>
                    <input
                      {...describe("firstName")}
                      aria-label="First name"
                      autoComplete="given-name"
                      className={inputClass(errorFor("firstName"))}
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </Field>
                  <Field id="checkout-lastName" label="Last Name">
                    <input
                      id="checkout-lastName"
                      aria-label="Last name"
                      autoComplete="family-name"
                      className={inputClass()}
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </Field>
                </div>
                <Field id={fieldId("address")} label="Address" error={errorFor("address")}>
                  <IconBox icon={<MapPin className="h-4 w-4" />}>
                    <input
                      {...describe("address")}
                      aria-label="Street address"
                      autoComplete="address-line1"
                      className={inputClass(errorFor("address"), "pl-14")}
                      placeholder="House number, street name, area"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </IconBox>
                </Field>
                <Field id="checkout-apartment" label="Apartment, suite, etc." optional>
                  <IconBox icon={<Building2 className="h-4 w-4" />}>
                    <input
                      id="checkout-apartment"
                      aria-label="Apartment or suite"
                      autoComplete="address-line2"
                      className={inputClass(undefined, "pl-14")}
                      placeholder="Apartment, suite, floor, etc."
                      value={apartment}
                      onChange={(e) => setApartment(e.target.value)}
                    />
                  </IconBox>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={fieldId("city")} label="City / Town" error={errorFor("city")}>
                    <IconBox icon={<Building2 className="h-4 w-4" />}>
                      <PakistanCitySelect
                        {...describe("city")}
                        aria-label="Delivery city"
                        placeholder="Select city"
                        className={cityClass(errorFor("city"))}
                        value={city}
                        onValueChange={setCity}
                        maxLength={120}
                      />
                    </IconBox>
                  </Field>
                  <Field id="checkout-postalCode" label="Postal Code" optional>
                    <IconBox icon={<Mailbox className="h-4 w-4" />}>
                      <input
                        id="checkout-postalCode"
                        aria-label="Postal code"
                        autoComplete="postal-code"
                        inputMode="numeric"
                        className={inputClass(undefined, "pl-14")}
                        placeholder="Postal code"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                      />
                    </IconBox>
                  </Field>
                </div>
                <Field id={fieldId("phone")} label="Phone Number" error={errorFor("phone")}>
                  <div
                    className={`flex h-12 min-w-0 items-stretch rounded-lg border bg-white transition focus-within:ring-2 sm:h-11 ${
                      errorFor("phone") ? "border-red-500 focus-within:ring-red-100" : "border-[#E5E9E5] focus-within:border-[#00543D] focus-within:ring-[#A8E52E]/40"
                    }`}
                  >
                    <span aria-hidden="true" className="flex w-11 shrink-0 items-center justify-center border-r border-[#E5E9E5] text-[#00543D]">
                      <Phone className="h-4 w-4" />
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 border-r border-[#E5E9E5] px-2.5 text-sm font-medium text-[#172033] sm:px-3">
                      <PakistanFlag className="hidden h-3 w-[18px] min-[360px]:block" />
                      <span aria-label="Pakistan country code +92">+92</span>
                    </span>
                    <input
                      {...describe("phone")}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      aria-label="Phone number"
                      className="min-w-0 flex-1 rounded-r-lg border-0 bg-transparent px-3 text-base text-[#172033] placeholder:text-[#9CA3AF] focus:outline-none sm:text-sm"
                      placeholder="300 1234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </Field>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#172033]">
                  <input
                    type="checkbox"
                    className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#00543D]"
                    checked={saveInfoNextTime}
                    onChange={(e) => setSaveInfoNextTime(e.target.checked)}
                  />
                  Save this information for next time
                </label>
              </div>
            </section>

            <section className={cardClass}>
              <SectionHeader step={3} title="Shipping Method" subtitle="Choose how you want to receive your order." />
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[#7CC243] bg-[#F3FAE6] px-3 py-3.5 sm:gap-4 sm:px-4">
                <input type="radio" name="shippingMethod" value="cod" defaultChecked className="h-5 w-5 shrink-0 accent-[#00543D]" />
                <Truck aria-hidden="true" className="hidden h-7 w-7 shrink-0 text-[#00543D] min-[380px]:block" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#172033] sm:text-[15px]">Cash on Delivery (COD)</span>
                  <span className="block text-xs text-[#6B7280] sm:text-sm">Pay when you receive your order at your doorstep</span>
                </span>
                <span className="shrink-0 text-sm font-bold text-[#172033] sm:text-base">
                  {deliveryCharge === 0 ? "FREE" : formatPKR(deliveryCharge)}
                </span>
              </label>
            </section>
          </div>

          <div className="min-w-0 space-y-5 sm:space-y-6">
            <aside id="order-summary" aria-label="Order summary" className={`${cardClass} scroll-mt-24`}>
              <SectionHeader
                icon={ShoppingCart}
                title="Order Summary"
                subtitle={itemCountLabel}
                action={<Link href="/cart" className="shrink-0 text-sm font-semibold text-[#00543D] underline underline-offset-2 hover:text-[#003F2E]">Edit Cart</Link>}
              />
              <ul className="-mr-1 space-y-4 pr-1 lg:max-h-[340px] lg:overflow-y-auto">
                {items.map((item) => (
                  <li
                    key={`${item.productId}-${item.variant || "default"}`}
                    className="flex items-start gap-3 sm:gap-4"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#E5E9E5] bg-[#F7F8F2] sm:h-[72px] sm:w-[72px]">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          unoptimized={item.image.startsWith("/")}
                          sizes="72px"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 break-words text-sm font-semibold text-[#172033] sm:text-[15px]">
                        {item.name}
                      </p>
                      {item.variant && <p className="truncate text-xs text-[#6B7280]">{item.variant}</p>}
                      <p className="text-xs text-[#6B7280] sm:text-sm">Qty: {item.quantity}</p>
                      <p className="text-sm font-bold text-[#172033]">
                        {formatPKR(item.price)}
                        {item.quantity > 1 && <span className="font-normal text-[#6B7280]"> each</span>}
                      </p>
                      {item.serviceId && <p className="mt-1 text-xs text-[#00543D]">{item.serviceName || "Service add-on"}: {formatPKR((item.servicePrice || 0) * item.quantity)}</p>}
                    </div>
                    <p className="shrink-0 self-center text-sm font-bold text-[#172033] sm:text-base">
                      {formatPKR(item.price * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-5 rounded-xl bg-[#F5F7F2] p-3.5 sm:p-4">
                <div className="mb-3 flex items-start gap-2.5">
                  <Tag aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#00543D]" />
                  <div>
                    <label htmlFor="checkout-coupon" className="block text-sm font-semibold text-[#172033]">Coupon Code</label>
                    <p className="text-xs text-[#6B7280] sm:text-[13px]">Have a coupon? Apply it here</p>
                  </div>
                </div>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-[#D9EFB5] bg-white px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#00543D]">
                      <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span className="truncate">{appliedCoupon.code}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => { setAppliedCoupon(null); setCouponMessage("Coupon removed."); setCouponTone("info"); }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-[#6B7280] hover:bg-[#F5F7F2] hover:text-[#172033]"
                    >
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                      Remove coupon
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      id="checkout-coupon"
                      value={couponInput}
                      onChange={e => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (!couponBusy && couponInput.trim()) void applyCoupon(); } }}
                      maxLength={32}
                      autoComplete="off"
                      className={inputClass(couponTone === "error" && couponMessage ? couponMessage : undefined, "flex-1 uppercase placeholder:normal-case")}
                      placeholder="Enter coupon code"
                    />
                    <LoadingButton
                      type="button"
                      loading={couponBusy}
                      loadingLabel="Applying…"
                      disabled={!couponInput.trim()}
                      onClick={applyCoupon}
                      className="h-12 shrink-0 rounded-lg bg-[#00543D] px-5 text-sm font-semibold text-white transition hover:bg-[#003F2E] disabled:opacity-50 sm:h-11 sm:px-6"
                    >
                      Apply
                    </LoadingButton>
                  </div>
                )}
                {couponMessage && (
                  <p role="status" className={`mt-2 text-sm ${couponTone === "error" ? "text-red-600" : couponTone === "success" ? "text-[#00543D]" : "text-[#6B7280]"}`}>
                    {couponMessage}
                  </p>
                )}
              </div>

              <dl className="mt-5 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#4B5563]">Product Subtotal</dt>
                  <dd className="font-semibold text-[#172033]">{formatPKR(productSubtotal)}</dd>
                </div>
                {serviceSubtotal > 0 && <div className="flex items-center justify-between gap-3"><dt className="text-[#4B5563]">Booked Services</dt><dd className="font-semibold text-[#172033]">{formatPKR(serviceSubtotal)}</dd></div>}
                {appliedCoupon && (
                  <div className="flex items-center justify-between gap-3 text-[#00543D]">
                    <dt>Discount ({appliedCoupon.code})</dt>
                    <dd className="font-semibold">-{formatPKR(appliedCoupon.discount)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#4B5563]">Delivery Charges<span className="block text-xs text-[#6B7280]">Includes applicable fulfilment and handling</span></dt>
                  <dd className="font-semibold text-[#172033]">
                    {deliveryCharge === 0 ? "FREE" : formatPKR(deliveryCharge)}
                  </dd>
                </div>
                {handlingFeeError && <p role="alert" className="text-xs text-red-600"><button type="button" onClick={() => setHandlingFeeVersion((v) => v + 1)} className="font-semibold underline">Retry checkout verification</button></p>}
              </dl>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#D9EFB5] bg-[#F3FAE6] px-4 py-3.5">
                <span className="text-lg font-bold text-[#00543D] sm:text-xl">Total</span>
                <span className="text-lg font-bold text-[#00543D] sm:text-xl">{formattedTotal ?? "…"}</span>
              </div>
            </aside>

            <section className={cardClass}>
              <SectionHeader icon={CreditCard} title="Payment Method" subtitle="All transactions are secure and encrypted." />
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[#7CC243] bg-[#F3FAE6] px-3 py-3.5 sm:gap-4 sm:px-4">
                <input type="radio" name="paymentMethod" value={paymentMethod} defaultChecked className="h-5 w-5 shrink-0 accent-[#00543D]" />
                <Banknote aria-hidden="true" className="h-7 w-7 shrink-0 text-[#00543D]" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#172033] sm:text-[15px]">Cash on Delivery (COD)</span>
                  <span className="block text-xs text-[#6B7280] sm:text-sm">Pay when you receive your order</span>
                </span>
              </label>
            </section>

            <section className={cardClass}>
              <SectionHeader icon={FileText} title="Billing Address" subtitle="Choose your billing address." />
              <div className="space-y-2.5">
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${sameBillingAddress ? "border-[#7CC243] bg-[#F3FAE6] font-medium" : "border-[#E5E9E5] bg-white hover:border-[#C9D3C9]"}`}>
                  <input
                    type="radio"
                    name="billingAddress"
                    className="h-5 w-5 shrink-0 accent-[#00543D]"
                    checked={sameBillingAddress}
                    onChange={() => setSameBillingAddress(true)}
                  />
                  Same as shipping address
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${!sameBillingAddress ? "border-[#7CC243] bg-[#F3FAE6] font-medium" : "border-[#E5E9E5] bg-white hover:border-[#C9D3C9]"}`}>
                  <input
                    type="radio"
                    name="billingAddress"
                    className="h-5 w-5 shrink-0 accent-[#00543D]"
                    checked={!sameBillingAddress}
                    onChange={() => setSameBillingAddress(false)}
                  />
                  Use a different billing address
                </label>
              </div>
              {!sameBillingAddress ? (
                <div className="mt-4 space-y-4 border-t border-[#E5E9E5] pt-4">
                  <Field id="checkout-billingCountry" label="Country">
                    <div className="relative min-w-0">
                      <span aria-hidden="true" className="pointer-events-none absolute inset-y-px left-px flex w-11 items-center justify-center border-r border-[#E5E9E5]">
                        <PakistanFlag className="h-3.5 w-5" />
                      </span>
                      <select
                        id="checkout-billingCountry"
                        aria-label="Billing country"
                        className={inputClass(undefined, "cursor-pointer appearance-none pl-14 pr-10")}
                        value={billingCountry}
                        onChange={(e) => setBillingCountry(e.target.value)}
                      >
                        <option value="Pakistan">Pakistan</option>
                      </select>
                      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                    </div>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Field id={fieldId("billingFirstName")} label="First Name" error={errorFor("billingFirstName")}>
                      <input
                        {...describe("billingFirstName")}
                        aria-label="Billing first name"
                        className={inputClass(errorFor("billingFirstName"))}
                        placeholder="First name"
                        value={billingFirstName}
                        onChange={(e) => setBillingFirstName(e.target.value)}
                      />
                    </Field>
                    <Field id="checkout-billingLastName" label="Last Name">
                      <input
                        id="checkout-billingLastName"
                        aria-label="Billing last name"
                        className={inputClass()}
                        placeholder="Last name"
                        value={billingLastName}
                        onChange={(e) => setBillingLastName(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field id={fieldId("billingAddress")} label="Address" error={errorFor("billingAddress")}>
                    <input
                      {...describe("billingAddress")}
                      aria-label="Billing street address"
                      className={inputClass(errorFor("billingAddress"))}
                      placeholder="House number, street name, area"
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                    />
                  </Field>
                  <Field id="checkout-billingApartment" label="Apartment, suite, etc." optional>
                    <input
                      id="checkout-billingApartment"
                      aria-label="Billing apartment or suite"
                      className={inputClass()}
                      placeholder="Apartment, suite, floor, etc."
                      value={billingApartment}
                      onChange={(e) => setBillingApartment(e.target.value)}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Field id={fieldId("billingCity")} label="City / Town" error={errorFor("billingCity")}>
                      <IconBox icon={<Building2 className="h-4 w-4" />}>
                        <PakistanCitySelect
                          {...describe("billingCity")}
                          aria-label="Billing city"
                          placeholder="Select city"
                          className={cityClass(errorFor("billingCity"))}
                          value={billingCity}
                          onValueChange={setBillingCity}
                          maxLength={120}
                        />
                      </IconBox>
                    </Field>
                    <Field id="checkout-billingPostalCode" label="Postal Code" optional>
                      <input
                        id="checkout-billingPostalCode"
                        aria-label="Billing postal code"
                        inputMode="numeric"
                        className={inputClass()}
                        placeholder="Postal code"
                        value={billingPostalCode}
                        onChange={(e) => setBillingPostalCode(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field id="checkout-billingPhone" label="Phone" optional>
                    <input
                      id="checkout-billingPhone"
                      type="tel"
                      inputMode="tel"
                      aria-label="Billing phone number"
                      className={inputClass()}
                      placeholder="0300 1234567"
                      value={billingPhone}
                      onChange={(e) => setBillingPhone(e.target.value)}
                    />
                  </Field>
                </div>
              ) : null}

              <div className="mt-6">
                <LoadingButton
                  type="submit"
                  loading={loading} loadingLabel="Placing order…" disabled={placeOrderDisabled}
                  className="flex h-14 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#3F8F2B] to-[#00543D] px-4 text-lg font-bold text-white shadow-[0_6px_16px_-6px_rgba(0,84,61,0.6)] transition hover:from-[#357D24] hover:to-[#003F2E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A8E52E]/60 disabled:cursor-not-allowed disabled:opacity-60 sm:text-xl"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <Lock aria-hidden="true" className="h-5 w-5" />
                    Place Order
                    <ArrowRight aria-hidden="true" className="h-5 w-5" />
                  </span>
                </LoadingButton>
                <p aria-live="polite" className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-[#4B5563] sm:text-[13px]">
                  {handlingFeeError ? (
                    <span className="text-red-600">We couldn&apos;t calculate your total. Use Retry above to continue.</span>
                  ) : handlingFee === null ? (
                    "Calculating your total…"
                  ) : (
                    <>
                      <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-[#00543D]" />
                      Your order is protected and secure
                    </>
                  )}
                </p>
              </div>
            </section>
          </div>
        </LoadingForm>
      </div>
    </main>
  );
}
