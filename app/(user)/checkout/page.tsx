"use client";

import { useEffect, useState } from "react";
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
const WALLET_SEP = "||";

function parseWallet(raw: string, fallbackName: string) {
  const val = (raw || "").trim();
  if (!val || val === "—") return { name: "", holder: "", number: "" };
  if (!val.includes(WALLET_SEP)) return { name: fallbackName, holder: "", number: val };
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

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const { isCustomer, authLoading, openAuthModal } = useCustomerAuth();
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<ISettings | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "cod">(
    "bank_transfer"
  );
  const [bankKey, setBankKey] = useState<BankKey>("meezanBank");
  const [file, setFile] = useState<File | null>(null);

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
      const next = [doneOrder.orderNumber, ...prev.filter((x) => x !== doneOrder.orderNumber)].slice(
        0,
        20
      );
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

  async function placeOrder(opts?: { paymentProofStagingId?: string }) {
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
        toast.error(`Order failed (${res.status}). Empty response — check server logs.`);
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
      setStep(3);
      clear();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handlePaySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Your cart is empty");
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
    const err = validateScreenshot(file);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      setLoading(true);
      const { id: stagingId } = await uploadImageWithId(file!, "inrange-payments");
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

  if (items.length === 0 && step !== 3 && !doneOrder) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-darkText/70 mb-4">Your cart is empty.</p>
        <Link
          href="/products"
          className="text-primaryBlue font-bold"
        >
          Browse products
        </Link>
      </div>
    );
  }

  if (step === 3 && doneOrder) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-card border border-borderGray bg-white p-8 shadow-card">
          <p className="text-green-600 font-semibold text-lg mb-2">Thank you!</p>
          <p className="text-darkText mb-1">Your order number:</p>
          <p className="text-2xl font-bold text-primaryBlue mb-6">
            {doneOrder.orderNumber}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
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
            className="w-full justify-center"
          />
          <Link
            href="/"
            className="mt-4 inline-block text-primaryBlue font-medium"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-darkText mb-2">Checkout</h1>
      <div className="flex gap-2 text-sm text-darkText/60 mb-8">
        <span className={step >= 1 ? "text-primaryBlue font-semibold" : ""}>
          1. Info
        </span>
        <span>→</span>
        <span className={step >= 2 ? "text-primaryBlue font-semibold" : ""}>
          2. Payment
        </span>
        <span>→</span>
        <span className={step >= 3 ? "text-primaryBlue font-semibold" : ""}>
          3. Done
        </span>
      </div>

      {step === 1 ? (
        <form
          className="space-y-4 rounded-card border border-borderGray bg-white p-6 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name || !phone || !email || !address || !city) {
              toast.error("Please fill in all fields");
              return;
            }
            setStep(2);
          }}
        >
          <h2 className="font-bold text-lg">Customer Info</h2>
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
            className="w-full rounded-xl border border-borderGray px-4 py-2.5 min-h-[80px]"
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
          <button
            type="submit"
            className="w-full rounded-xl bg-primaryBlue py-3 font-bold text-white hover:bg-darkBlue"
          >
            Continue
          </button>
        </form>
      ) : (
        <form
          onSubmit={handlePaySubmit}
          className="space-y-6 rounded-card border border-borderGray bg-white p-6 shadow-card"
        >
          <h2 className="font-bold text-lg">Payment</h2>

          <div className="rounded-xl bg-lightGray/80 p-4 text-sm">
            <p className="font-semibold text-darkText">Order summary</p>
            <p className="text-primaryBlue font-bold mt-1">
              {formatPKR(subtotal)}
              {paymentMethod === "cod" && codAllowed ? (
                <span className="text-darkText font-normal">
                  {" "}
                  + {formatPKR(codCharge)} COD
                </span>
              ) : null}
            </p>
            {paymentMethod === "cod" && codAllowed ? (
              <p className="font-bold text-primaryBlue mt-1">
                Total: {formatPKR(totalWithCod)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="pm"
                checked={paymentMethod === "bank_transfer"}
                onChange={() => setPaymentMethod("bank_transfer")}
              />
              <span className="font-medium">Bank Transfer</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="pm"
                checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
              />
              <span className="font-medium">Cash on Delivery</span>
            </label>
          </div>

          {paymentMethod === "bank_transfer" ? (
            <div className="space-y-3 border-t border-borderGray pt-4">
              <p className="font-semibold text-sm">Choose bank account</p>
              {(
                [
                  ["meezanBank", settings?.bankAccounts.meezanBank.accountTitle || "Meezan Bank"],
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
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bk"
                    checked={bankKey === key}
                    onChange={() => setBankKey(key)}
                  />
                  {label}
                </label>
              ))}
              <pre className="text-xs bg-lightGray rounded-xl p-3 whitespace-pre-wrap font-sans text-darkText">
                {bankDetails(bankKey)}
              </pre>
              <div>
                <label className="block text-sm font-medium mb-1">
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
          ) : (
            <div className="text-sm text-darkText/80 border-t border-borderGray pt-4">
              {codAllowed ? (
                <p>
                  Cash on delivery is available. Fee:{" "}
                  <strong>{formatPKR(codCharge)}</strong>
                </p>
              ) : (
                <p className="text-red-600">
                  COD is not available for your city. Please pay by bank transfer
                  or choose another city.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl border-2 border-borderGray py-3 font-semibold"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={
                loading || (paymentMethod === "cod" && !codAllowed)
              }
              className="flex-1 rounded-xl bg-primaryYellow py-3 font-bold text-white disabled:opacity-50"
            >
              {loading ? "Processing…" : "Place Order"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
