"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { getSession, useSession } from "next-auth/react";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatPKR } from "@/lib/format";
import { PAKISTANI_CITIES } from "@/lib/pakistani-cities";
import { WhatsAppButton } from "@/components/user/WhatsAppButton";
import type { ISettings } from "@/types/settings";
type PaymentMethod = "cod";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const { isCustomer, authLoading, openAuthModal } = useCustomerAuth();
  const { data: session } = useSession();
  const [settings, setSettings] = useState<ISettings | null>(null);
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [apartment, setApartment] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Pakistan");
  const [marketingOptIn, setMarketingOptIn] = useState(true);
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

  const paymentMethod: PaymentMethod = "cod";

  const [doneOrder, setDoneOrder] = useState<{
    orderNumber: string;
    _id: string;
    customerPhone: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

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
    })();
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
  const deliveryCharge = subtotal > 1000 ? 0 : 250;
  const totalAmount = subtotal + deliveryCharge;

  const infoComplete = useMemo(
    () =>
      Boolean(
        firstName.trim() &&
          phone.trim() &&
          email.trim() &&
          address.trim() &&
          city.trim()
      ),
    [firstName, phone, email, address, city]
  );

  async function placeOrder() {
    const s = await getSession();
    if (s?.user?.role !== "customer") {
      toast.error("Please sign in or create an account first");
      openAuthModal("signup");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerFullName,
          customerPhone: phone,
          customerEmail: email,
          customerAddress: [address, apartment].filter(Boolean).join(", "),
          city,
          paymentMethod,
          products: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            variant: i.variant,
          })),
        }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        orderNumber?: string;
        _id?: string;
        customerPhone?: string;
      } = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          toast.error(
            res.ok
              ? "Invalid response from server"
              : `Order failed (${res.status}). Try again.`
          );
          return;
        }
      } else if (!res.ok) {
        toast.error(
          `Order failed (${res.status}). Empty response — check server logs.`
        );
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Could not place order");
        return;
      }
      toast.success("Order placed successfully!");
      setDoneOrder({
        orderNumber: data.orderNumber ?? "",
        _id: data._id ?? "",
        customerPhone: data.customerPhone ?? "",
      });
      clear();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
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
    if (!infoComplete) {
      toast.error("Please fill in all fields in Customer Info");
      return;
    }

    if (!codAllowed) {
      toast.error("Please check your selected city");
      return;
    }
    await placeOrder();
  }

  const placeOrderDisabled =
    loading ||
    items.length === 0 ||
    !infoComplete ||
    (paymentMethod === "cod" && !codAllowed);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center text-darkText/70">
        Loading…
      </div>
    );
  }

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
          <button
            type="button"
            onClick={() => openAuthModal("signup")}
            className="w-full rounded-xl bg-primaryYellow py-3 font-bold text-white mb-3"
          >
            Sign up / Login
          </button>
          <Link href="/cart" className="text-primaryBlue text-sm font-medium">
            ← Back to cart
          </Link>
        </div>
      </div>
    );
  }

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
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
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
            </button>
            <Link
              href={`/track-order?order=${encodeURIComponent(doneOrder.orderNumber)}`}
              className="rounded-xl bg-primaryBlue py-2.5 text-sm font-semibold text-white hover:bg-darkBlue"
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
            className="mb-4 block w-full rounded-xl bg-primaryBlue py-3 text-center text-sm font-bold text-white hover:bg-darkBlue"
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

  return (
    <div className="bg-[#f8f9fb] pb-12">
      <div className="bg-[#0f6ab0] py-2 text-xs font-semibold tracking-wide text-white">
        <div className="overflow-hidden whitespace-nowrap">
          <p className="inline-block min-w-full animate-[checkoutMarquee_18s_linear_infinite]">
            ENJOY FREE DELIVERY ON ORDERS ABOVE Rs.1,000 | CASH ON DELIVERY
            AVAILABLE | EASY RETURNS & EXCHANGES | PAKISTAN&apos;S #1 BUDGET
            SHOP
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1120px] px-4 pt-8">
        <h1 className="mb-6 text-2xl font-bold text-darkText">Checkout</h1>

        <form
          onSubmit={handleCheckoutSubmit}
          className="grid gap-6 lg:h-[calc(100vh-170px)] lg:grid-cols-[minmax(0,560px)_300px] lg:justify-center lg:overflow-hidden"
        >
          <div className="space-y-6 lg:max-w-[560px] lg:overflow-y-auto lg:pr-2">
            <section className="space-y-5 rounded-card border border-borderGray bg-white p-6 shadow-card">
              <h2 className="text-lg font-bold text-darkText">Contact</h2>
              <input
                required
                type="email"
                className="w-full rounded-md border border-borderGray px-3 py-2.5"
                placeholder="Email or mobile phone number"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-darkText">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primaryBlue"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                />
                Email me with news and offers
              </label>
            </section>

            <section className="space-y-5 rounded-card border border-borderGray bg-white p-6 shadow-card">
              <h2 className="text-lg font-bold text-darkText">Delivery</h2>
              <select
                className="w-full rounded-md border border-borderGray px-3 py-2.5"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="Pakistan">Pakistan</option>
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  required
                  className="w-full rounded-md border border-borderGray px-3 py-2.5"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                  className="w-full rounded-md border border-borderGray px-3 py-2.5"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <input
                required
                className="w-full rounded-md border border-borderGray px-3 py-2.5"
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <input
                className="w-full rounded-md border border-borderGray px-3 py-2.5"
                placeholder="Apartment, suite, etc. (optional)"
                value={apartment}
                onChange={(e) => setApartment(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  required
                  className="w-full rounded-md border border-borderGray px-3 py-2.5"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  <option value="">City</option>
                  {PAKISTANI_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full rounded-md border border-borderGray px-3 py-2.5"
                  placeholder="Postal code (optional)"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
              <div className="overflow-hidden rounded-md border border-borderGray bg-white">
                <div className="flex items-stretch">
                  <input
                    required
                    className="w-full border-0 px-3 py-2.5 focus:outline-none"
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <div className="flex items-center gap-2 border-l border-borderGray px-3 text-sm text-darkText/80">
                    <span className="inline-flex h-5 w-6 items-center justify-center rounded-[2px] bg-green-700 text-[10px] font-bold text-white">
                      PK
                    </span>
                    <span aria-hidden>▾</span>
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-darkText/90">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={saveInfoNextTime}
                  onChange={(e) => setSaveInfoNextTime(e.target.checked)}
                />
                Save this information for next time
              </label>
            </section>

            <section className="space-y-6 rounded-card border border-borderGray bg-white p-6 shadow-card">
              <div>
                <h2 className="text-lg font-bold text-darkText">Shipping method</h2>
                <div className="mt-3 rounded-md border border-[#2a6df2] bg-[#f4f7ff] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-darkText">Cash on Delivery</span>
                    <span className="font-semibold text-darkText">
                      {deliveryCharge === 0 ? "FREE" : formatPKR(deliveryCharge)}
                    </span>
                  </div>
                </div>
              </div>

              <h2 className="text-lg font-bold text-darkText">Payment</h2>
              <p className="-mt-3 text-sm text-darkText/70">
                All transactions are secure and encrypted.
              </p>
              <div className="overflow-hidden rounded-[8px] border border-[#2f6df6] bg-[#f4f7ff]">
                <div className="border-b border-[#2f6df6] bg-[#f4f7ff] px-4 py-3 text-base font-semibold text-darkText">
                  Cash on Delivery (COD)
                </div>
                <p className="bg-white px-4 py-3 text-center text-sm text-darkText/80">
                  Pay at your doorstep
                </p>
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-darkText">Billing address</h3>
                <div className="overflow-hidden rounded-md border border-borderGray">
                  <label className="flex cursor-pointer items-center gap-3 border-b border-borderGray bg-[#f4f7ff] px-4 py-3 text-darkText">
                    <input
                      type="radio"
                      name="billingAddress"
                      checked={sameBillingAddress}
                      onChange={() => setSameBillingAddress(true)}
                    />
                    <span className="font-medium">Same as shipping address</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-darkText">
                    <input
                      type="radio"
                      name="billingAddress"
                      checked={!sameBillingAddress}
                      onChange={() => setSameBillingAddress(false)}
                    />
                    <span>Use a different billing address</span>
                  </label>
                </div>
                {!sameBillingAddress ? (
                  <div className="rounded-md border border-borderGray bg-white p-3">
                    <div className="space-y-3">
                      <select
                        className="w-full rounded-md border border-borderGray px-3 py-2.5"
                        value={billingCountry}
                        onChange={(e) => setBillingCountry(e.target.value)}
                      >
                        <option value="Pakistan">Pakistan</option>
                      </select>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          className="w-full rounded-md border border-borderGray px-3 py-2.5"
                          placeholder="First name"
                          value={billingFirstName}
                          onChange={(e) => setBillingFirstName(e.target.value)}
                        />
                        <input
                          className="w-full rounded-md border border-borderGray px-3 py-2.5"
                          placeholder="Last name"
                          value={billingLastName}
                          onChange={(e) => setBillingLastName(e.target.value)}
                        />
                      </div>
                      <input
                        className="w-full rounded-md border border-borderGray px-3 py-2.5"
                        placeholder="Address"
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                      />
                      <input
                        className="w-full rounded-md border border-borderGray px-3 py-2.5"
                        placeholder="Apartment, suite, etc. (optional)"
                        value={billingApartment}
                        onChange={(e) => setBillingApartment(e.target.value)}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <select
                          className="w-full rounded-md border border-borderGray px-3 py-2.5"
                          value={billingCity}
                          onChange={(e) => setBillingCity(e.target.value)}
                        >
                          <option value="">City</option>
                          {PAKISTANI_CITIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <input
                          className="w-full rounded-md border border-borderGray px-3 py-2.5"
                          placeholder="Postal code (optional)"
                          value={billingPostalCode}
                          onChange={(e) => setBillingPostalCode(e.target.value)}
                        />
                      </div>
                      <input
                        className="w-full rounded-md border border-borderGray px-3 py-2.5"
                        placeholder="Phone (optional)"
                        value={billingPhone}
                        onChange={(e) => setBillingPhone(e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-borderGray pt-6">
                <button
                  type="submit"
                  disabled={placeOrderDisabled}
                  className="w-full rounded-[8px] bg-[#f5a623] py-3 text-sm font-bold text-white disabled:opacity-50 sm:text-base"
                >
                  {loading ? "Processing…" : "Complete order"}
                </button>
              </div>
            </section>
          </div>

          <aside className="h-fit rounded-card border border-borderGray bg-white p-5 shadow-card lg:w-[300px]">
            <h3 className="mb-4 text-lg font-bold text-darkText">Order Summary</h3>
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variant || "default"}`}
                  className="flex items-start gap-3 border-b border-borderGray pb-3"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-borderGray bg-white">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                        unoptimized={item.image.startsWith("/")}
                        sizes="56px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-darkText">
                      {item.name}
                    </p>
                    <p className="text-xs text-darkText/60">Qty: {item.quantity}</p>
                    <p className="text-sm font-bold text-primaryBlue">
                      {formatPKR(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-darkText/70">Subtotal</span>
                <span className="font-semibold">{formatPKR(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-darkText/70">Delivery charges</span>
                <span className="font-semibold">
                  {deliveryCharge === 0 ? "FREE" : formatPKR(deliveryCharge)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-borderGray pt-2 text-base font-bold text-darkText">
                <span>Total</span>
                <span>{formatPKR(totalAmount)}</span>
              </div>
            </div>
          </aside>
        </form>
      </div>
      <style jsx>{`
        @keyframes checkoutMarquee {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  );
}
