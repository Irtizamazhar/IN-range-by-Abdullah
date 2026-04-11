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
    <div className="flex min-h-screen bg-[#F8F9FA]">
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
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="min-h-screen">{children}</div>
      </div>
    </div>
  );
}
