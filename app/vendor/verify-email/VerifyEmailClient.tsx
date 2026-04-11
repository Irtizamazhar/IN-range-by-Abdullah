"use client";

import Link from "next/link";
import { useState } from "react";

const accent = "#F59E0B";

export function VerifyEmailClient({
  initialStatus,
}: {
  initialStatus?: string;
}) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const status = initialStatus;

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setPending(true);
    try {
      const res = await fetch("/api/vendor/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setErr(data.error || "Could not send email");
        return;
      }
      setMsg(data.message || "If an account exists, we sent a verification link.");
    } catch {
      setErr("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        {status === "verified" && (
          <>
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-neutral-900"
              style={{ backgroundColor: accent }}
            >
              ✓
            </div>
            <h1 className="mt-6 text-2xl font-extrabold text-neutral-900">
              Email verified
            </h1>
            <p className="mt-3 text-neutral-600">
              Your email is confirmed. You can sign in once your application is
              approved by our team.
            </p>
            <Link
              href="/vendor/login"
              className="mt-8 inline-block font-bold hover:underline"
              style={{ color: accent }}
            >
              Go to sign in
            </Link>
          </>
        )}

        {status === "invalid" && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-2xl font-bold text-red-700">
              !
            </div>
            <h1 className="mt-6 text-2xl font-extrabold text-neutral-900">
              Link invalid or expired
            </h1>
            <p className="mt-3 text-neutral-600">
              Request a new verification email below.
            </p>
          </>
        )}

        {!status && (
          <>
            <h1 className="text-2xl font-extrabold text-neutral-900">
              Email verification
            </h1>
            <p className="mt-3 text-neutral-600">
              Open the link we emailed you, or resend the message here.
            </p>
          </>
        )}

        {(status === "invalid" || !status) && (
          <form onSubmit={resend} className="mt-10 text-left">
            <label
              htmlFor="re-email"
              className="block text-sm font-semibold text-neutral-800"
            >
              Email address
            </label>
            <input
              id="re-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/40"
            />
            {err && (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {err}
              </p>
            )}
            {msg && (
              <p className="mt-2 text-sm text-green-800" role="status">
                {msg}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="mt-4 w-full rounded-xl py-3 font-extrabold text-neutral-900 disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              {pending ? "Sending…" : "Resend verification email"}
            </button>
          </form>
        )}

        <Link
          href="/vendor/login"
          className="mt-10 inline-block text-sm font-semibold text-neutral-600 hover:text-neutral-900"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
