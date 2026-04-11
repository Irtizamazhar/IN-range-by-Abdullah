"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VendorLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/vendor/logout", {
        method: "POST",
        credentials: "include",
      });
      router.replace("/vendor/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void logout()}
      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-neutral-800 disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
