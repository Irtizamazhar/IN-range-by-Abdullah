"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

export default function ResetPasswordPage() {
  const { openAuthModal } = useCustomerAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) return toast.error("Use at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) return toast.error("This reset link is incomplete");

    setBusy(true);
    try {
      const response = await fetch("/api/customer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) return toast.error(data.error || "Could not reset password");
      setComplete(true);
      toast.success("Password updated");
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[65vh] max-w-lg items-center px-4 py-14">
      <section className="w-full rounded-card border border-borderGray bg-white p-6 shadow-card sm:p-8">
        <h1 className="text-2xl font-bold text-darkText">Choose a new password</h1>
        {complete ? (
          <div className="mt-5">
            <p className="text-darkText/70">
              Your password has been changed and older customer sessions were signed out.
            </p>
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className="mt-6 w-full rounded-xl bg-brand-primary px-4 py-3 font-bold text-brand-dark hover:bg-brand-hover"
            >
              Sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-darkText">
              New password
              <input
                required
                minLength={8}
                maxLength={128}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5"
              />
            </label>
            <label className="block text-sm font-semibold text-darkText">
              Confirm password
              <input
                required
                minLength={8}
                maxLength={128}
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5"
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-xl bg-brand-primary px-4 py-3 font-bold text-brand-dark hover:bg-brand-hover disabled:opacity-60"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
        <Link href="/" className="mt-5 inline-block text-sm font-semibold text-primaryBlue">
          Back to shop
        </Link>
      </section>
    </main>
  );
}
