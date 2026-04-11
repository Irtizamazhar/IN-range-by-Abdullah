"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { VendorMe } from "@/lib/vendor-me-type";

/** No vendor session cookie expected — skip /api/vendor/me to avoid noisy 401s in dev. */
const PUBLIC_VENDOR_PATHS = new Set([
  "/vendor/login",
  "/vendor/register",
  "/vendor/verify-email",
  "/vendor/forgot-password",
]);

type VendorAuthState = {
  vendor: VendorMe | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const VendorAuthContext = createContext<VendorAuthState | null>(null);

function VendorAuthFallbackProvider({ children }: { children: React.ReactNode }) {
  const refresh = useCallback(async () => {}, []);
  const value = useMemo(
    () => ({ vendor: null, loading: true, refresh }),
    [refresh]
  );
  return (
    <VendorAuthContext.Provider value={value}>
      {children}
    </VendorAuthContext.Provider>
  );
}

function VendorAuthProviderInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [vendor, setVendor] = useState<VendorMe | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vendor/me", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setVendor(null);
        return;
      }
      const data = (await res.json()) as { vendor?: VendorMe };
      setVendor(data.vendor ?? null);
    } catch {
      setVendor(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pathname) {
      setLoading(false);
      return;
    }
    if (PUBLIC_VENDOR_PATHS.has(pathname)) {
      setVendor(null);
      setLoading(false);
      return;
    }
    void refresh();
  }, [pathname, refresh]);

  const value = useMemo(
    () => ({ vendor, loading, refresh }),
    [vendor, loading, refresh]
  );

  return (
    <VendorAuthContext.Provider value={value}>
      {children}
    </VendorAuthContext.Provider>
  );
}

/** Suspense: usePathname needs a boundary or pathNameContext can be null during SSR/streaming. */
export function VendorAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={<VendorAuthFallbackProvider>{children}</VendorAuthFallbackProvider>}
    >
      <VendorAuthProviderInner>{children}</VendorAuthProviderInner>
    </Suspense>
  );
}

export function useVendorAuth(): VendorAuthState {
  const ctx = useContext(VendorAuthContext);
  if (!ctx) {
    throw new Error("useVendorAuth must be used within VendorAuthProvider");
  }
  return ctx;
}
