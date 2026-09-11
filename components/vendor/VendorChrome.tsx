"use client";

import { Suspense } from "react";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";

export function VendorChrome({
  shopName,
  children,
}: {
  shopName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-brand-background">
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
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="min-h-full">{children}</div>
      </div>
    </div>
  );
}
