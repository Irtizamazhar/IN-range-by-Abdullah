"use client";

import Link from "next/link";
import { useState } from "react";
import { PasswordToggleInput } from "@/components/ui/PasswordToggleInput";
import { LogoMark } from "@/components/user/LogoMark";

const accent = "#F59E0B";

export default function VendorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showAppeal, setShowAppeal] = useState(false);
  const [appealMessage, setAppealMessage] = useState("");
  const [appealPending, setAppealPending] = useState(false);
  const [appealDone, setAppealDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowAppeal(false);
    setAppealDone(false);
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
        } else if (data.code === "suspended") {
          setError("Account suspended. You can submit an appeal below.");
          setShowAppeal(true);
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

  async function submitAppeal() {
    const msg = appealMessage.trim();
    if (msg.length < 10) {
      setError("Please enter at least 10 characters for your appeal.");
      return;
    }
    setAppealPending(true);
    setError(null);
    try {
      const res = await fetch("/api/vendor/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message: msg }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error || "Could not submit appeal.");
        return;
      }
      setAppealDone(true);
      setAppealMessage("");
    } catch {
      setError("Network error while submitting appeal.");
    } finally {
      setAppealPending(false);
    }
  }

  return (
    <div className="flex min-h-screen overflow-hidden bg-white">
      <aside className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#f97316_0%,#ea580c_40%,#c2410c_100%)] p-6 md:flex">
        <div className="vendor-float-1 pointer-events-none absolute -left-12 -top-12 h-64 w-64 rounded-full bg-white/10" />
        <div className="vendor-float-2 pointer-events-none absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-white/10" />
        <div className="vendor-float-3 pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10" />

        <div className="relative z-10 w-full max-w-sm">
          <div className="vendor-logo-float mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-white p-2 shadow-[0_8px_25px_rgba(0,0,0,0.2)]">
            <LogoMark
              href={null}
              className="[&_img]:max-h-[60px] [&_img]:max-w-[100px] [&_img]:w-auto"
            />
          </div>

          <h2 className="vendor-fade-up mb-1 text-[22px] font-bold text-white">
            Welcome Back!
          </h2>
          <p className="mb-4 text-[13px] text-white/85">
            Sign in to manage your shop and grow your business online
          </p>

          <div>
            {[
              "📦 Manage products & orders easily",
              "🚀 Grow faster with featured visibility",
              "💰 Track earnings with secure payouts",
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

      <section className="right-side flex h-screen w-full flex-col md:w-1/2">
        <div className="px-8 pt-4">
          <Link
            href="/"
            className="inline-block text-xs font-semibold text-orange-500 hover:text-orange-600"
          >
            ← Store home
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-2">
          <div className="mx-auto w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
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
            {showAppeal ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-900">
                  Appeal for account reactivation
                </p>
                <textarea
                  rows={3}
                  value={appealMessage}
                  onChange={(e) => setAppealMessage(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-500"
                  placeholder="Explain why your account should be reviewed again..."
                />
                <button
                  type="button"
                  disabled={appealPending}
                  onClick={() => void submitAppeal()}
                  className="mt-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {appealPending ? "Submitting..." : "Submit appeal"}
                </button>
                {appealDone ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    Appeal submitted. Admin will review it soon.
                  </p>
                ) : null}
              </div>
            ) : null}

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
                <PasswordToggleInput
                  id="vendor-password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 py-2.5 pl-3 pr-11 text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
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

        <style jsx>{`
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
          .right-side::-webkit-scrollbar {
            display: none;
          }
          .right-side {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </section>
    </div>
  );
}
