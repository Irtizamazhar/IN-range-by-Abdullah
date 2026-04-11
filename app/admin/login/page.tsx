"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { LogoMark } from "@/components/user/LogoMark";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    window.location.href = "/admin/dashboard";
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primaryBlue to-darkBlue px-4">
      <div className="rounded-2xl bg-white p-8 shadow-xl w-full max-w-md">
        <div className="flex justify-center mb-5">
          <LogoMark
            href={null}
            className="justify-center shrink-0 [&_img]:max-h-32 sm:[&_img]:max-h-36"
          />
        </div>
        <h1 className="text-xl font-bold text-center text-darkText mb-6">
          Admin Login
        </h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            className="w-full rounded-xl border border-borderGray px-4 py-2.5"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            className="w-full rounded-xl border border-borderGray px-4 py-2.5"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? (
            <p className="text-sm text-red-600 text-center">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primaryBlue py-3 font-bold text-white hover:bg-darkBlue disabled:opacity-50"
          >
            {loading ? "…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
