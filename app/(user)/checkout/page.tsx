"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { getSession, useSession } from "next-auth/react";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { formatPKR } from "@/lib/format";
import { PAKISTANI_CITIES } from "@/lib/pakistani-cities";
import { WhatsAppButton } from "@/components/user/WhatsAppButton";
import type { ISettings } from "@/types/settings";
import { uploadImageWithId } from "@/lib/cloudinary-client-upload";

type BankKey = "meezanBank" | "hbl" | "easypaisa" | "jazzCash";
type PaymentMethod = "bank_transfer" | "cod" | "card";

const WALLET_SEP = "||";

function parseWallet(raw: string, fallbackName: string) {
  const val = (raw || "").trim();
  if (!val || val === "—") return { name: "", holder: "", number: "" };
  if (!val.includes(WALLET_SEP))
    return { name: fallbackName, holder: "", number: val };
  const parts = val.split(WALLET_SEP).map((p) => (p || "").trim());
  if (parts.length === 2) {
    const [name, number] = parts;
    return { name: name || fallbackName, holder: "", number: number || "" };
  }
  const [name, holder, number] = parts;
  return {
    name: name || fallbackName,
    holder: holder || "",
    number: number || "",
  };
}

function validateScreenshot(file: File | null): string | null {
  if (!file) return "Payment screenshot is required";
  const okTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!okTypes.includes(file.type)) {
    return "Only JPG, PNG, or WebP images are allowed";
  }
  if (file.size > 5 * 1024 * 1024) {
    return "File must be smaller than 5 MB";
  }
  return null;
}

function formatCardDigitsDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 16);
  return (d.match(/.{1,4}/g) || []).join(" ").trim();
}

function formatExpiryDisplay(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function luhnValid(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i]!, 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const { isCustomer, authLoading, openAuthModal } = useCustomerAuth();
  const { data: session } = useSession();
  const [settings, setSettings] = useState<ISettings | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    "bank_transfer"
  );
  const [bankKey, setBankKey] = useState<BankKey>("meezanBank");
  const [file, setFile] = useState<File | null>(null);

  const [cardholderName, setCardholderName] = useState("");
  const [cardNumberDigits, setCardNumberDigits] = useState("");
  const [cardExpiryRaw, setCardExpiryRaw] = useState("");
  const [cardCvv, setCardCvv] = useState("");

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
      setName((prev) => prev || s.user?.name || "");
      setPhone((prev) => prev || s.user?.phone || "");
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isCustomer]);

  useEffect(() => {
    if (session?.user?.role !== "customer") return;
    setEmail((prev) => prev || session.user.email || "");
    setName((prev) => prev || session.user.name || "");
    setPhone((prev) => prev || session.user.phone || "");
  }, [session]);

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

  const codAllowed =
    settings?.codAvailableCities?.some(
      (c) => c.toLowerCase() === city.trim().toLowerCase()
    ) ?? false;
  const codCharge = settings?.codCharges ?? 150;
  const totalWithCod =
    paymentMethod === "cod" && codAllowed ? subtotal + codCharge : subtotal;

  const infoComplete = useMemo(
    () =>
      Boolean(
        name.trim() &&
          phone.trim() &&
          email.trim() &&
          address.trim() &&
          city.trim()
      ),
    [name, phone, email, address, city]
  );

  const cardNumberDisplay = useMemo(
    () => formatCardDigitsDisplay(cardNumberDigits),
    [cardNumberDigits]
  );
  const cardExpiryDisplay = useMemo(
    () => formatExpiryDisplay(cardExpiryRaw),
    [cardExpiryRaw]
  );

  function bankDetails(key: BankKey) {
    if (!settings) return null;
    const b = settings.bankAccounts;
    if (key === "meezanBank")
      return `Bank: ${b.meezanBank.accountTitle || "Meezan Bank"}\nAccount: ${b.meezanBank.accountNumber}`;
    if (key === "hbl")
      return `Bank: ${b.hbl.accountTitle || "HBL"}\nAccount: ${b.hbl.accountNumber}`;
    if (key === "easypaisa") {
      const ep = parseWallet(b.easypaisa.mobileNumber, "EasyPaisa");
      return `${ep.name}${ep.holder ? ` (${ep.holder})` : ""}: ${ep.number}`;
    }
    const jc = parseWallet(b.jazzCash.mobileNumber, "JazzCash");
    return `${jc.name}${jc.holder ? ` (${jc.holder})` : ""}: ${jc.number}`;
  }

  async function placeOrder(opts?: {
    paymentProofStagingId?: string;
    cardPaymentMeta?: { last4: string; expiry: string; holderName: string };
  }) {
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
          customerName: name,
          customerPhone: phone,
          customerEmail: email,
          customerAddress: address,
          city,
          paymentMethod,
          bankAccount: paymentMethod === "bank_transfer" ? bankKey : undefined,
          ...(opts?.paymentProofStagingId
            ? { paymentProofStagingId: opts.paymentProofStagingId }
            : {}),
          ...(paymentMethod === "card" && opts?.cardPaymentMeta
            ? { cardPaymentMeta: opts.cardPaymentMeta }
            : {}),
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

    if (paymentMethod === "cod") {
      if (!codAllowed) {
        toast.error("Cash on delivery is not available for this city");
        return;
      }
      await placeOrder();
      return;
    }

    if (paymentMethod === "card") {
      const pan = cardNumberDigits.replace(/\D/g, "");
      const exp = cardExpiryRaw.replace(/\D/g, "");
      const holder = cardholderName.trim();
      if (pan.length !== 16) {
        toast.error("Enter a valid 16-digit card number");
        return;
      }
      if (!luhnValid(pan)) {
        toast.error("Card number does not pass validation");
        return;
      }
      if (exp.length !== 4) {
        toast.error("Enter expiry as MM/YY");
        return;
      }
      const mm = parseInt(exp.slice(0, 2), 10);
      if (!Number.isFinite(mm) || mm < 1 || mm > 12) {
        toast.error("Invalid expiry month");
        return;
      }
      if (!holder) {
        toast.error("Enter cardholder name");
        return;
      }
      if (cardCvv.trim().length < 3) {
        toast.error("Enter CVV");
        return;
      }
      await placeOrder({
        cardPaymentMeta: {
          last4: pan.slice(-4),
          expiry: exp,
          holderName: holder,
        },
      });
      return;
    }

    const err = validateScreenshot(file);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      setLoading(true);
      const { id: stagingId } = await uploadImageWithId(
        file!,
        "inrange-payments"
      );
      toast.success("Screenshot uploaded");
      await placeOrder({ paymentProofStagingId: stagingId });
      toast.success(
        "We received your proof. We will confirm within 24 hours.",
        { duration: 5000 }
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload error");
    } finally {
      setLoading(false);
    }
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
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-8">
      <h1 className="mb-6 text-2xl font-bold text-darkText">Checkout</h1>

      <div
        className="mb-8 flex w-full items-center gap-2 text-xs sm:text-sm"
        role="list"
        aria-label="Checkout progress"
      >
        {(
          [
            { id: 1 as const, label: "Info" },
            { id: 2 as const, label: "Payment" },
            { id: 3 as const, label: "Done" },
          ] as const
        ).map((s, i, arr) => {
          const current = !infoComplete ? s.id === 1 : s.id === 2;
          const completed = s.id === 1 && infoComplete;
          const circleClass = current
            ? "border-primaryBlue bg-primaryBlue text-white"
            : completed
              ? "border-primaryBlue/70 bg-primaryBlue/10 text-primaryBlue"
              : "border-borderGray bg-white text-darkText/45";
          return (
            <div key={s.id} className="flex min-w-0 flex-1 items-center gap-2">
              <div
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                role="listitem"
              >
                <span
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums",
                    circleClass,
                  ].join(" ")}
                >
                  {s.id}
                </span>
                <span
                  className={[
                    "max-w-full truncate text-center font-semibold",
                    current ? "text-darkText" : "text-darkText/50",
                  ].join(" ")}
                >
                  {s.label}
                </span>
              </div>
              {i < arr.length - 1 ? (
                <div
                  className={[
                    "h-0.5 min-w-[10px] flex-1 rounded-full",
                    i === 0 && infoComplete
                      ? "bg-primaryBlue/45"
                      : "bg-borderGray",
                  ].join(" ")}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleCheckoutSubmit} className="space-y-8">
        <section className="space-y-4 rounded-card border border-borderGray bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-darkText">Customer info</h2>
          <input
            required
            className="w-full rounded-xl border border-borderGray px-4 py-2.5"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            required
            className="w-full rounded-xl border border-borderGray px-4 py-2.5"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            required
            type="email"
            className="w-full rounded-xl border border-borderGray px-4 py-2.5"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <textarea
            required
            className="min-h-[80px] w-full rounded-xl border border-borderGray px-4 py-2.5"
            placeholder="Full address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <select
            required
            className="w-full rounded-xl border border-borderGray px-4 py-2.5"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">Select city</option>
            {PAKISTANI_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </section>

        <section className="space-y-6 rounded-card border border-borderGray bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold text-darkText">Payment</h2>

          <div className="rounded-xl bg-lightGray/80 p-4 text-sm">
            <p className="font-semibold text-darkText">Order summary</p>
            <p className="mt-1 font-bold text-primaryBlue">
              {formatPKR(subtotal)}
              {paymentMethod === "cod" && codAllowed ? (
                <span className="font-normal text-darkText">
                  {" "}
                  + {formatPKR(codCharge)} COD
                </span>
              ) : null}
            </p>
            {paymentMethod === "cod" && codAllowed ? (
              <p className="mt-1 font-bold text-primaryBlue">
                Total: {formatPKR(totalWithCod)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="pm"
                checked={paymentMethod === "bank_transfer"}
                onChange={() => setPaymentMethod("bank_transfer")}
              />
              <span className="font-medium">Bank transfer</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="pm"
                checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
              />
              <span className="font-medium">Cash on delivery</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="pm"
                checked={paymentMethod === "card"}
                onChange={() => setPaymentMethod("card")}
              />
              <span className="font-medium">Card payment</span>
            </label>
          </div>

          {paymentMethod === "bank_transfer" ? (
            <div className="space-y-3 border-t border-borderGray pt-4">
              <p className="text-sm font-semibold">Choose bank account</p>
              {(
                [
                  [
                    "meezanBank",
                    settings?.bankAccounts.meezanBank.accountTitle ||
                      "Meezan Bank",
                  ],
                  ["hbl", settings?.bankAccounts.hbl.accountTitle || "HBL"],
                  [
                    "easypaisa",
                    parseWallet(
                      settings?.bankAccounts.easypaisa.mobileNumber || "",
                      "EasyPaisa"
                    ).name,
                  ],
                  [
                    "jazzCash",
                    parseWallet(
                      settings?.bankAccounts.jazzCash.mobileNumber || "",
                      "JazzCash"
                    ).name,
                  ],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="radio"
                    name="bk"
                    checked={bankKey === key}
                    onChange={() => setBankKey(key)}
                  />
                  {label}
                </label>
              ))}
              <pre className="whitespace-pre-wrap rounded-xl bg-lightGray p-3 font-sans text-xs text-darkText">
                {bankDetails(bankKey)}
              </pre>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Payment screenshot (JPG/PNG/WebP, max 5MB)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="text-sm"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          ) : null}

          {paymentMethod === "cod" ? (
            <div className="border-t border-borderGray pt-4 text-sm text-darkText/80">
              {codAllowed ? (
                <p>
                  Cash on delivery is available for your city. Fee:{" "}
                  <strong>{formatPKR(codCharge)}</strong> will be added to your
                  order total.
                </p>
              ) : (
                <p className="text-red-600">
                  COD is not available for your city. Please pay by bank
                  transfer or card, or choose another city.
                </p>
              )}
            </div>
          ) : null}

          {paymentMethod === "card" ? (
            <div className="border-t border-borderGray pt-4">
              <div className="relative overflow-hidden rounded-2xl border border-borderGray bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-lg">
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -bottom-10 left-1/4 h-40 w-40 rounded-full bg-primaryBlue/20"
                  aria-hidden
                />
                <p className="text-xs font-medium uppercase tracking-widest text-white/60">
                  Card details
                </p>
                <p className="mt-4 font-mono text-lg tracking-[0.2em] sm:text-xl">
                  {cardNumberDisplay || "•••• •••• •••• ••••"}
                </p>
                <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-white/50">
                      Cardholder
                    </p>
                    <p className="max-w-[200px] truncate text-sm font-semibold">
                      {cardholderName || "YOUR NAME"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-white/50">
                      Expires
                    </p>
                    <p className="font-mono text-sm font-semibold">
                      {cardExpiryDisplay || "MM/YY"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-darkText">
                    Cardholder name
                  </label>
                  <input
                    className="w-full rounded-xl border border-borderGray px-4 py-2.5"
                    placeholder="Name on card"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    autoComplete="cc-name"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-darkText">
                    Card number
                  </label>
                  <input
                    className="w-full rounded-xl border border-borderGray px-4 py-2.5 font-mono tracking-wider"
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={cardNumberDisplay}
                    onChange={(e) =>
                      setCardNumberDigits(
                        e.target.value.replace(/\D/g, "").slice(0, 16)
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-darkText">
                    Expiry (MM/YY)
                  </label>
                  <input
                    className="w-full rounded-xl border border-borderGray px-4 py-2.5 font-mono"
                    placeholder="MM/YY"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    value={cardExpiryDisplay}
                    onChange={(e) =>
                      setCardExpiryRaw(
                        e.target.value.replace(/\D/g, "").slice(0, 4)
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-darkText">
                    CVV
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-borderGray px-4 py-2.5 font-mono"
                    placeholder="•••"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) =>
                      setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-darkText/55">
                Card details are verified on our side; only a masked summary is
                stored with your order.
              </p>
            </div>
          ) : null}
        </section>

        <div className="border-t border-borderGray pt-6">
          <button
            type="submit"
            disabled={placeOrderDisabled}
            className="w-full rounded-xl bg-primaryYellow py-3 text-sm font-bold text-white disabled:opacity-50 sm:text-base"
          >
            {loading ? "Processing…" : "Place order"}
          </button>
        </div>
      </form>
    </div>
  );
}
