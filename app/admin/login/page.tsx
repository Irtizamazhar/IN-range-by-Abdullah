"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { LoadingForm } from "@/components/ui/LoadingForm";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { LogoMark } from "@/components/user/LogoMark";
import { PasswordToggleInput } from "@/components/ui/PasswordToggleInput";
import { navigateDocument } from "@/lib/navigate-document";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (!res || res.error) {
      setError("Invalid email or password");
      return;
    }
    await navigateDocument("/admin/dashboard");
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
        <LoadingForm onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            className="w-full rounded-xl border border-borderGray px-4 py-2.5"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordToggleInput
            required
            className="w-full rounded-xl border border-borderGray py-2.5 pl-4 pr-11"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error ? (
            <p className="text-sm text-red-600 text-center">{error}</p>
          ) : null}
          <LoadingButton loadingLabel="Signing in…"
            type="submit"

            className="w-full rounded-xl bg-brand-primary py-3 font-bold text-brand-dark hover:bg-brand-hover disabled:opacity-50"
          >
            {"Sign in"}
          </LoadingButton>
        </LoadingForm>
      </div>
    </div>
  );
}
