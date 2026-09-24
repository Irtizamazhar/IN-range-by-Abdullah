"use client";

import { Suspense } from "react";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { DashboardShell } from "@/components/DashboardShell";

export function VendorChrome({
  shopName,
  children,
}: {
  shopName: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardShell label="Vendor" sidebar={
      <Suspense
        fallback={
          <aside
            className="w-64 shrink-0 bg-footerDark text-white"
            aria-hidden
          />
        }
      >
        <VendorSidebar shopName={shopName} />
      </Suspense>
    }>
      <div className="min-h-full">{children}</div>
    </DashboardShell>
  );
}
