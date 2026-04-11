"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVendorAuth } from "@/context/VendorAuthContext";

function VendorAuthSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-48 rounded-lg bg-amber-100/80" />
        <div className="h-4 w-full max-w-xl rounded bg-neutral-200" />
        <div className="h-4 w-full max-w-lg rounded bg-neutral-200" />
        <div className="h-32 w-full rounded-xl bg-neutral-100" />
      </div>
    </div>
  );
}

export function VendorProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { vendor, loading } = useVendorAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!vendor) {
      router.replace("/vendor/login");
    }
  }, [loading, vendor, router]);

  if (loading) {
    return <VendorAuthSkeleton />;
  }
  if (!vendor) {
    return <VendorAuthSkeleton />;
  }

  return <>{children}</>;
}
