"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function VendorForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/vendor/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) return toast.error(data.error || "Could not send reset email");
      setMessage(data.message || "Check your inbox for a reset link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand-background px-4 py-16">
      <section className="mx-auto max-w-md rounded-2xl border border-borderGray bg-white p-8 shadow-card">
        <h1 className="text-2xl font-extrabold text-darkText">Reset seller password</h1>
        {message ? (
          <p className="mt-5 rounded-xl bg-brand-soft p-4 text-sm text-brand-dark">{message}</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-darkText">
              Registered email
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5"
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-xl bg-brand-primary px-4 py-3 font-bold text-brand-dark hover:bg-brand-hover disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <Link href="/vendor/login" className="mt-6 inline-block text-sm font-bold text-primaryBlue hover:underline">
          ← Back to sign in
        </Link>
      </section>
    </main>
  );
}
