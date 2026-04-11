"use client";

import Link from "next/link";
import { useState } from "react";

const accent = "#F59E0B";

export default function VendorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/vendor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        const base = data.error || "Could not sign in";
        if (data.code === "unverified") {
          setError(
            `${base} You can resend the link from the verify email page.`
          );
        } else {
          setError(base);
        }
        return;
      }
      // Full page navigation: cookie from login is always sent on the next load.
      // Client router + immediate refresh() could race (session looks empty once) and
      // VendorProtectedRoute sent users back to login — felt like needing two clicks.
      window.location.assign("/vendor/dashboard");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="text-sm font-semibold text-neutral-600 hover:text-neutral-900"
        >
          ← Store home
        </Link>
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
            Vendor sign in
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Access your seller dashboard
          </p>

          {error && (
            <div
              className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="vendor-email"
                className="block text-sm font-semibold text-neutral-800"
              >
                Email
              </label>
              <input
                id="vendor-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none ring-amber-400/0 transition focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
              />
            </div>
            <div>
              <label
                htmlFor="vendor-password"
                className="block text-sm font-semibold text-neutral-800"
              >
                Password
              </label>
              <input
                id="vendor-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-400 text-amber-500 focus:ring-amber-400"
                />
                Remember me
              </label>
              <Link
                href="/vendor/forgot-password"
                className="text-sm font-semibold hover:underline"
                style={{ color: accent }}
              >
                Forgot password?
              </Link>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl py-3 text-base font-extrabold text-neutral-900 shadow-sm transition hover:brightness-95 disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-600">
            New vendor?{" "}
            <Link
              href="/vendor/register"
              className="font-bold hover:underline"
              style={{ color: accent }}
            >
              Create an account
            </Link>
            {" · "}
            <Link
              href="/vendor/verify-email"
              className="font-semibold text-neutral-500 hover:underline"
            >
              Verify email
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
