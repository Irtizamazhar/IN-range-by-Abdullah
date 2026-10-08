"use client";
import { LoadingButton } from "@/components/ui/LoadingButton";

import { useLoadingRouter as useRouter } from "@/hooks/useLoadingRouter";
import { useState } from "react";
import { clearVendorLoginRememberPrefs } from "@/lib/vendor-login-remember-prefs";

export function VendorLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      const response = await fetch("/api/vendor/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      clearVendorLoginRememberPrefs();
      await router.replace("/vendor/login");
    } finally {
      setPending(false);
    }
  }

  return (
    <LoadingButton loadingLabel="Signing out…"
      type="button"
      disabled={pending}
      onClick={() => logout()}
      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-neutral-800 disabled:opacity-60"
    >
      {"Sign out"}
    </LoadingButton>
  );
}
