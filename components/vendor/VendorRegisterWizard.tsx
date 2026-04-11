"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

import { PasswordToggleInput } from "@/components/ui/PasswordToggleInput";
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
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }
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
          Check your email
        </h1>
        <p className="mt-3 text-neutral-600">
          We sent a verification link to <strong>{email}</strong>. After you
          verify, our team will review your application.
        </p>
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

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Link
          href="/vendor/login"
          className="text-sm font-semibold text-neutral-600 hover:text-neutral-900"
        >
          ← Back to sign in
        </Link>

        <h1 className="mt-6 text-2xl font-extrabold text-neutral-900">
          Vendor registration
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Step {step} of 3 — tell us about you, your shop, and payout details
        </p>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: accent }}
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
          <div className="mt-8 space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <Field label="Full name" htmlFor="vr-name">
              <input
                id="vr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
              />
            </Field>
            <Field label="Email" htmlFor="vr-email">
              <input
                id="vr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
              />
              {emailCheckLoading && (
                <p className="mt-1 text-xs text-neutral-500">Checking…</p>
              )}
              {!emailCheckLoading && email.includes("@") && (
                <p
                  className={`mt-1 text-xs font-semibold ${
                    emailAvailable
                      ? "text-green-700"
                      : emailAvailable === false
                        ? "text-red-700"
                        : "text-neutral-500"
                  }`}
                >
                  {emailAvailable === false
                    ? "This email is already registered"
                    : emailAvailable === true
                      ? "Email is available"
                      : null}
                </p>
              )}
            </Field>
            <Field label="Password" htmlFor="vr-pw">
              <PasswordToggleInput
                id="vr-pw"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 py-2.5 pl-3 pr-11 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
              />
              <div className="mt-2 flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 flex-1 rounded-full bg-neutral-200"
                    style={{
                      backgroundColor: i < score ? accent : undefined,
                    }}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-neutral-500">
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
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
              />
            </Field>
            <Field label="City" htmlFor="vr-city">
              <input
                id="vr-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
              />
            </Field>
            <Field label="Address" htmlFor="vr-address">
              <textarea
                id="vr-address"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
              />
            </Field>
            <button
              type="button"
              disabled={!canAdvanceFrom1()}
              onClick={() => setStep(2)}
              className="w-full rounded-xl py-3 font-extrabold text-neutral-900 disabled:opacity-40"
              style={{ backgroundColor: accent }}
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <Field label="Shop / brand name" htmlFor="vr-shop">
              <input
                id="vr-shop"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
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
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
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
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
              />
            </Field>
            <Field label="Primary category" htmlFor="vr-cat">
              <select
                id="vr-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!shopCategories.length}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40 disabled:cursor-not-allowed disabled:bg-neutral-100"
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
                className="flex-1 rounded-xl border border-neutral-300 py-3 font-bold text-neutral-800"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canAdvanceFrom2()}
                onClick={() => setStep(3)}
                className="flex-1 rounded-xl py-3 font-extrabold text-neutral-900 disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <Field label="Bank name" htmlFor="vr-bank">
              <input
                id="vr-bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
              />
            </Field>
            <Field label="Account title" htmlFor="vr-title">
              <input
                id="vr-title"
                value={accountTitle}
                onChange={(e) => setAccountTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
              />
            </Field>
            <Field label="Account number" htmlFor="vr-acc">
              <input
                id="vr-acc"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
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
                className="flex-1 rounded-xl border border-neutral-300 py-3 font-bold text-neutral-800"
              >
                Back
              </button>
              <button
                type="button"
                disabled={pending || !docsValid()}
                onClick={() => void submit()}
                className="flex-1 rounded-xl py-3 font-extrabold text-neutral-900 disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                {pending ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </div>
        )}
      </div>
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
        className="text-sm font-semibold text-neutral-800"
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
