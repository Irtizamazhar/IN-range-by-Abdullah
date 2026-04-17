"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { LogoMark } from "@/components/user/LogoMark";
import { fetchShopCategoryNameList } from "@/lib/shop-category-names";

const accent = "#F59E0B";

type DocSlot = "cnic_front" | "cnic_back" | "license";

function formatPkMobile(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 4) return d;
  return `${d.slice(0, 4)}-${d.slice(4)}`;
}

function formatCnic(raw: string): string {
  const x = raw.replace(/\D/g, "").slice(0, 13);
  if (x.length <= 5) return x;
  if (x.length <= 12) return `${x.slice(0, 5)}-${x.slice(5)}`;
  return `${x.slice(0, 5)}-${x.slice(5, 12)}-${x.slice(12, 13)}`;
}

function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

export function VendorRegisterWizard() {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [doneInfo, setDoneInfo] = useState<{
    requireEmail: boolean;
    message: string;
  } | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const [shopName, setShopName] = useState("");
  const [businessType, setBusinessType] = useState<"individual" | "company">(
    "individual"
  );
  const [businessRegNo, setBusinessRegNo] = useState("");
  const [cnic, setCnic] = useState("");
  const [shopCategories, setShopCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");

  const [bankName, setBankName] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const [docs, setDocs] = useState<Record<DocSlot, File | null>>({
    cnic_front: null,
    cnic_back: null,
    license: null,
  });

  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const score = passwordScore(password);

  const checkEmail = useCallback(async (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailAvailable(null);
      return;
    }
    setEmailCheckLoading(true);
    try {
      const res = await fetch(
        `/api/vendor/check-email?email=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as { available?: boolean };
      setEmailAvailable(data.available ?? false);
    } catch {
      setEmailAvailable(null);
    } finally {
      setEmailCheckLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void checkEmail(email);
    }, 450);
    return () => window.clearTimeout(t);
  }, [email, checkEmail]);

  useEffect(() => {
    let cancelled = false;
    void fetchShopCategoryNameList().then((names) => {
      if (cancelled) return;
      setShopCategories(names);
      setCategory((prev) =>
        prev && names.includes(prev) ? prev : names[0] ?? ""
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step !== 3) return;
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.files;
      if (!items?.length) return;
      const f = items[0];
      if (!f.type.startsWith("image/")) return;
      e.preventDefault();
      setDocs((prev) => {
        if (!prev.cnic_front) return { ...prev, cnic_front: f };
        if (!prev.cnic_back) return { ...prev, cnic_back: f };
        if (businessType === "company" || !prev.license) {
          return { ...prev, license: f };
        }
        return { ...prev, cnic_front: f };
      });
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [step, businessType]);

  function setDoc(slot: DocSlot, file: File | null) {
    setDocs((d) => ({ ...d, [slot]: file }));
  }

  function onDrop(slot: DocSlot, e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) setDoc(slot, f);
  }

  function canAdvanceFrom1(): boolean {
    return (
      name.trim().length > 0 &&
      email.includes("@") &&
      password.length >= 8 &&
      phone.replace(/\D/g, "").length === 11 &&
      city.trim().length > 0 &&
      address.trim().length >= 5 &&
      emailAvailable === true
    );
  }

  function canAdvanceFrom2(): boolean {
    if (shopName.trim().length < 1) return false;
    if (cnic.replace(/\D/g, "").length !== 13) return false;
    if (!shopCategories.length || !category.trim()) return false;
    if (businessType === "company" && businessRegNo.trim().length < 2) {
      return false;
    }
    return true;
  }

  function docsValid(): boolean {
    if (!docs.cnic_front || !docs.cnic_back) return false;
    if (businessType === "company" && !docs.license) return false;
    return true;
  }

  async function submit() {
    setError(null);
    if (!docsValid()) {
      setError("Upload required documents.");
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("email", email.trim().toLowerCase());
      fd.append("password", password);
      fd.append("phone", phone);
      fd.append("city", city.trim());
      fd.append("address", address.trim());
      fd.append("shopName", shopName.trim());
      fd.append("businessType", businessType);
      if (businessType === "company") {
        fd.append("businessRegNo", businessRegNo.trim());
      }
      fd.append("cnic", cnic);
      fd.append("category", category);
      fd.append("bankName", bankName.trim());
      fd.append("accountTitle", accountTitle.trim());
      fd.append("accountNumber", accountNumber.trim());
      if (docs.cnic_front) fd.append("cnic_front", docs.cnic_front);
      if (docs.cnic_back) fd.append("cnic_back", docs.cnic_back);
      if (docs.license) fd.append("license", docs.license);

      const res = await fetch("/api/vendor/register", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        requireEmailVerification?: boolean;
      };
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }
      setDoneInfo({
        requireEmail: data.requireEmailVerification === true,
        message:
          typeof data.message === "string" && data.message.trim()
            ? data.message.trim()
            : "",
      });
      setDone(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-neutral-900"
          style={{ backgroundColor: accent }}
        >
          ✓
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-neutral-900">
          {doneInfo?.requireEmail ? "Check your email" : "Application submitted"}
        </h1>
        <p className="mt-3 text-neutral-600">
          {doneInfo?.requireEmail ? (
            <>
              We sent a verification link to <strong>{email}</strong>. Open that
              link, then wait for admin approval before the dashboard is available.
            </>
          ) : (
            <>
              {doneInfo?.message ? (
                doneInfo.message
              ) : (
                <>
                  No email verification step right now. Use the same email and
                  password after an admin approves your seller account.
                </>
              )}
            </>
          )}
        </p>
        {doneInfo?.requireEmail ? (
          <ul className="mt-4 list-disc space-y-2 pl-5 text-left text-sm text-neutral-600">
            <li>
              <strong>Sign in</strong> works only after you verify your email.
            </li>
            <li>
              The <strong>dashboard</strong> opens only after your application is
              approved.
            </li>
          </ul>
        ) : (
          <ul className="mt-4 list-disc space-y-2 pl-5 text-left text-sm text-neutral-600">
            <li>
              Wait for <strong>admin approval</strong> (you will not need a
              verification email link for this step).
            </li>
            <li>
              Then <strong>sign in</strong> on the vendor page — you will go to
              the dashboard automatically.
            </li>
          </ul>
        )}
        <Link
          href="/vendor/login"
          className="mt-8 inline-block font-bold hover:underline"
          style={{ color: accent }}
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  const pct = step === 1 ? 33 : step === 2 ? 66 : 100;
  const inputClass =
    "mt-1 h-9 w-full rounded-lg border-[1.5px] border-gray-200 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none transition-all duration-200 focus:border-[1.5px] focus:border-orange-500 focus:bg-orange-50/40 focus:shadow-[0_0_0_3px_rgba(249,115,22,0.15)]";
  const inputErrorClass =
    "border-[1.5px] border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.1)]";
  const textareaClass =
    "mt-1 h-12 w-full resize-none rounded-lg border-[1.5px] border-gray-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-all duration-200 focus:border-[1.5px] focus:border-orange-500 focus:bg-orange-50/40 focus:shadow-[0_0_0_3px_rgba(249,115,22,0.15)]";
  const primaryBtnClass =
    "h-11 w-full rounded-[10px] border-0 bg-[linear-gradient(135deg,#f97316_0%,#f59e0b_100%)] px-3 text-[15px] font-semibold text-white shadow-[0_4px_15px_rgba(249,115,22,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(249,115,22,0.5)] active:translate-y-0 active:shadow-[0_4px_12px_rgba(249,115,22,0.3)] disabled:cursor-not-allowed disabled:opacity-40";
  const emailErrorClass =
    "mt-0.5 flex items-center gap-1 text-[11px] font-medium text-red-500";

  return (
    <div className="vendor-reg-shell flex h-screen overflow-hidden bg-white">
      <aside className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#f97316_0%,#ea580c_40%,#c2410c_100%)] p-6 md:flex">
        <div className="pointer-events-none absolute -left-12 -top-12 h-64 w-64 rounded-full bg-white/10 vendor-float-1" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-white/10 vendor-float-2" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 vendor-float-3" />

        <div className="relative z-10 w-full max-w-sm">
          <div className="vendor-logo-float mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-white p-2 shadow-[0_8px_25px_rgba(0,0,0,0.2)]">
            <LogoMark
              href={null}
              className="[&_img]:max-h-[60px] [&_img]:max-w-[100px] [&_img]:w-auto"
            />
          </div>

          <h2 className="vendor-fade-up mb-1 text-[22px] font-bold text-white">
            Start Selling Today!
          </h2>
          <p className="mb-4 text-[13px] text-white/85">
            Join thousands of vendors and grow your business online
          </p>

          <div>
            {[
              "✅ Free shop setup — no upfront cost",
              "🚀 Auto featured after 14 days",
              "💰 Fast & secure payments",
            ].map((item, idx) => (
              <div
                key={item}
                className={`mb-2 flex items-center gap-2.5 rounded-[10px] border border-white/25 bg-white/15 px-[14px] py-[10px] text-[13px] text-white backdrop-blur-[10px] transition-all duration-200 hover:translate-x-1.5 hover:bg-white/20 ${
                  idx === 0
                    ? "vendor-card-in-1"
                    : idx === 1
                      ? "vendor-card-in-2"
                      : "vendor-card-in-3"
                }`}
              >
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="right-side vendor-reg-right flex h-screen w-full flex-col md:w-1/2">
        <div className="relative z-10 px-8 pb-0 pt-4">
          <Link
            href="/vendor/login"
            className="inline-block text-xs font-semibold text-orange-500 hover:text-orange-600"
          >
            ← Back to sign in
          </Link>
        </div>

        <div className="right-content flex-1 overflow-y-auto px-8 py-2">
          <div className="mx-auto w-full max-w-lg">
          <h1 className="text-xl font-semibold text-neutral-900">
            Registration as Seller
          </h1>
          <p className="mb-2 mt-0 text-xs text-gray-400">
            Step {step} of 3 — tell us about you, your shop, and payout details
          </p>

          <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-300 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          {error && (
            <div
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="mt-1 space-y-2 pb-2">
            <Field label="Full name" htmlFor="vr-name">
              <input
                id="vr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Email" htmlFor="vr-email">
              <input
                id="vr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${inputClass} ${emailAvailable === false ? inputErrorClass : ""}`}
              />
              {emailCheckLoading && (
                <p className="mt-1 text-xs text-neutral-500">Checking…</p>
              )}
              {!emailCheckLoading && email.includes("@") && (
                <>
                  {emailAvailable === false ? (
                    <p className={emailErrorClass}>⚠️ This email is already registered</p>
                  ) : emailAvailable === true ? (
                    <p className="mt-0.5 text-xs font-medium text-green-700">Email is available</p>
                  ) : null}
                </>
              )}
            </Field>
            <Field label="Password" htmlFor="vr-pw">
              <div className="relative mt-1">
                <input
                  id="vr-pw"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 w-full rounded-lg border-[1.5px] border-gray-200 bg-white py-1.5 pl-3 pr-10 text-sm text-neutral-900 outline-none transition-all duration-200 focus:border-[1.5px] focus:border-orange-500 focus:bg-orange-50/40 focus:shadow-[0_0_0_3px_rgba(249,115,22,0.15)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
              <div className="mt-1 flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-0.5 flex-1 rounded-full bg-neutral-200"
                    style={{
                      backgroundColor: i < score ? accent : undefined,
                    }}
                  />
                ))}
              </div>
              <p className="mb-2 mt-1 text-xs text-neutral-500">
                Use 8+ characters with mixed case, numbers, or symbols.
              </p>
            </Field>
            <Field label="Phone (03XX-XXXXXXX)" htmlFor="vr-phone">
              <input
                id="vr-phone"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(formatPkMobile(e.target.value))}
                placeholder="0300-1234567"
                className={inputClass}
              />
            </Field>
            <Field label="City" htmlFor="vr-city">
              <input
                id="vr-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Address" htmlFor="vr-address">
              <textarea
                id="vr-address"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={textareaClass}
              />
            </Field>
          </div>
          )}

          {step === 2 && (
            <div className="mt-2 space-y-2 pb-2">
            <Field label="Shop / brand name" htmlFor="vr-shop">
              <input
                id="vr-shop"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <div>
              <p className="text-sm font-semibold text-neutral-800">
                Business type
              </p>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="bt"
                    checked={businessType === "individual"}
                    onChange={() => setBusinessType("individual")}
                  />
                  Individual
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="bt"
                    checked={businessType === "company"}
                    onChange={() => setBusinessType("company")}
                  />
                  Company
                </label>
              </div>
            </div>
            {businessType === "company" && (
              <Field label="Business registration no." htmlFor="vr-reg">
                <input
                  id="vr-reg"
                  value={businessRegNo}
                  onChange={(e) => setBusinessRegNo(e.target.value)}
                  className={inputClass}
                />
              </Field>
            )}
            <Field label="CNIC (00000-0000000-0)" htmlFor="vr-cnic">
              <input
                id="vr-cnic"
                inputMode="numeric"
                value={cnic}
                onChange={(e) => setCnic(formatCnic(e.target.value))}
                placeholder="35202-1234567-1"
                className={inputClass}
              />
            </Field>
            <Field label="Primary category" htmlFor="vr-cat">
              <select
                id="vr-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!shopCategories.length}
                className="mt-1 h-9 w-full rounded-lg border-[1.5px] border-gray-200 px-3 text-sm text-neutral-900 outline-none transition focus:border-orange-500 disabled:cursor-not-allowed disabled:bg-neutral-100"
              >
                {!shopCategories.length ? (
                  <option value="">Loading categories…</option>
                ) : (
                  shopCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                )}
              </select>
            </Field>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-10 flex-1 rounded-xl border border-neutral-300 px-3 text-sm font-bold text-neutral-800"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canAdvanceFrom2()}
                onClick={() => setStep(3)}
                className="h-10 flex-1 rounded-[10px] bg-[linear-gradient(135deg,#f97316,#f59e0b)] px-3 text-sm font-semibold text-white shadow-[0_4px_15px_rgba(249,115,22,0.4)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(249,115,22,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
          )}

          {step === 3 && (
            <div className="mt-2 space-y-2 pb-2">
            <Field label="Bank name" htmlFor="vr-bank">
              <input
                id="vr-bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Account title" htmlFor="vr-title">
              <input
                id="vr-title"
                value={accountTitle}
                onChange={(e) => setAccountTitle(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Account number" htmlFor="vr-acc">
              <input
                id="vr-acc"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className={inputClass}
              />
            </Field>

            <p className="text-sm font-semibold text-neutral-800">
              Documents (JPG / PNG / WebP, max 5MB each)
            </p>
            <p className="text-xs text-neutral-500">
              Click or drag files into each box. On this step you can also paste
              an image from the clipboard (Ctrl+V).
            </p>

            <DocDrop
              label="CNIC front"
              required
              file={docs.cnic_front}
              onFile={(f) => setDoc("cnic_front", f)}
              onDrop={(e) => onDrop("cnic_front", e)}
            />
            <DocDrop
              label="CNIC back"
              required
              file={docs.cnic_back}
              onFile={(f) => setDoc("cnic_back", f)}
              onDrop={(e) => onDrop("cnic_back", e)}
            />
            <DocDrop
              label={
                businessType === "company"
                  ? "Business license (required)"
                  : "Business license (optional)"
              }
              required={businessType === "company"}
              file={docs.license}
              onFile={(f) => setDoc("license", f)}
              onDrop={(e) => onDrop("license", e)}
            />

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="h-10 flex-1 rounded-xl border border-neutral-300 px-3 text-sm font-bold text-neutral-800"
              >
                Back
              </button>
              <button
                type="button"
                disabled={pending || !docsValid()}
                onClick={() => void submit()}
                className="h-10 flex-1 rounded-[10px] bg-[linear-gradient(135deg,#f97316,#f59e0b)] px-3 text-sm font-semibold text-white shadow-[0_4px_15px_rgba(249,115,22,0.4)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(249,115,22,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </div>
          )}
          </div>
        </div>

        <div className="shrink-0 bg-white px-8 pb-5 pt-3">
          {step === 1 ? (
            <button
              type="button"
              disabled={!canAdvanceFrom1()}
              onClick={() => setStep(2)}
              className={primaryBtnClass}
            >
              Continue →
            </button>
          ) : null}
        </div>
      </section>
      <style jsx>{`
        .right-side::-webkit-scrollbar {
          display: none;
        }
        .right-side {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .vendor-float-1 {
          animation: float1 6s ease-in-out infinite;
        }
        .vendor-float-2 {
          animation: float2 8s ease-in-out infinite;
        }
        .vendor-float-3 {
          animation: float3 5s ease-in-out infinite;
        }
        .vendor-logo-float {
          animation: logoFloat 3s ease-in-out infinite;
        }
        .vendor-card-in-1 {
          opacity: 0;
          animation: slideIn 0.5s ease forwards 0.2s;
        }
        .vendor-card-in-2 {
          opacity: 0;
          animation: slideIn 0.5s ease forwards 0.4s;
        }
        .vendor-card-in-3 {
          opacity: 0;
          animation: slideIn 0.5s ease forwards 0.6s;
        }
        .vendor-fade-up {
          opacity: 0;
          animation: fadeUp 0.6s ease forwards;
        }
        @keyframes float1 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(20px, -30px) scale(1.1);
          }
        }
        @keyframes float2 {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-15px, 20px) scale(0.95);
          }
        }
        @keyframes float3 {
          0%,
          100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(25px, 15px);
          }
        }
        @keyframes logoFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-height: 700px) {
          .vendor-reg-shell {
            font-size: 0.95rem;
          }
          .vendor-reg-shell aside,
          .vendor-reg-right {
            padding: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold text-neutral-800"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function DocDrop({
  label,
  required: req,
  file,
  onFile,
  onDrop,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onFile: (f: File | null) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const inputId = useId();
  return (
    <div>
      <p className="text-xs font-semibold text-neutral-700">
        {label}
        {req ? " *" : ""}
      </p>
      <label
        htmlFor={inputId}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-600 hover:border-amber-400"
      >
        {file ? (
          <span className="font-medium text-neutral-900">{file.name}</span>
        ) : (
          <>
            <span>Click to upload or drag image here</span>
            <span className="mt-1 text-xs text-neutral-500">PNG, JPG, WebP</span>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <button
          type="button"
          className="mt-1 text-xs font-semibold text-red-600 hover:underline"
          onClick={() => onFile(null)}
        >
          Remove
        </button>
      )}
    </div>
  );
}
