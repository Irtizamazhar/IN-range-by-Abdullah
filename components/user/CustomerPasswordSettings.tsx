"use client";

import { FormEvent, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { PasswordToggleInput } from "@/components/ui/PasswordToggleInput";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

export function CustomerPasswordSettings({ hasLocalPassword }: { hasLocalPassword: boolean }) {
  const search = useSearchParams();
  const { openAuthModal } = useCustomerAuth();
  const [showForm] = useState(search?.get("password") === "reauth");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function beginGoogleReauthentication() {
    setBusy(true);
    try {
      const response = await fetch("/api/customer/password/google-reauth", { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not start Google reauthentication.");
      await signIn("google", { callbackUrl: "/account?tab=profile&password=reauth" }, { prompt: "login", max_age: "0" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start Google reauthentication.");
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) return toast.error("Use at least 8 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      const response = await fetch("/api/customer/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not set your website password.");
      toast.success("Website password set. Please sign in again.");
      await signOut({ callbackUrl: "/login?mode=signin" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set your website password.");
      setBusy(false);
    }
  }

  if (hasLocalPassword) {
    return (
      <div className="mt-6 max-w-xl rounded-2xl border border-borderGray bg-white p-6 shadow-card">
        <h2 className="text-xl font-bold">Website password</h2>
        <p className="mt-2 text-sm text-darkText/65">Your account already has a website password. Use the secure Forgot Password flow to change it.</p>
        <button type="button" onClick={() => openAuthModal("login")} className="mt-4 rounded-xl bg-brand-primary px-5 py-3 font-bold">Open password reset</button>
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-xl rounded-2xl border border-borderGray bg-white p-6 shadow-card">
      <h2 className="text-xl font-bold">Website password</h2>
      {!showForm ? (
        <>
          <p className="mt-2 text-sm text-darkText/65">You signed in with Google and do not have a separate website password yet.</p>
          <button type="button" disabled={busy} onClick={() => void beginGoogleReauthentication()} className="mt-4 rounded-xl bg-brand-primary px-5 py-3 font-bold disabled:opacity-60">{busy ? "Opening Google…" : "Set website password"}</button>
        </>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-4">
          <p className="text-sm text-darkText/65">Google reauthentication completed. Choose a password for this website only.</p>
          <label className="block text-sm font-semibold">New password<PasswordToggleInput required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5" /></label>
          <label className="block text-sm font-semibold">Confirm password<PasswordToggleInput required minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-borderGray px-3 py-2.5" /></label>
          <button disabled={busy} className="rounded-xl bg-brand-primary px-5 py-3 font-bold disabled:opacity-60">{busy ? "Saving…" : "Save website password"}</button>
        </form>
      )}
      <p className="mt-4 text-xs leading-5 text-darkText/60">This password is separate from your Google password. Google credentials are never requested or stored here.</p>
      {hasLocalPassword && <Link href="/login?mode=signin" className="mt-3 inline-block text-sm font-bold text-brand-link">Go to sign in</Link>}
    </div>
  );
}