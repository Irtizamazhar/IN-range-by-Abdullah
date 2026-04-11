"use client";

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
      <VendorSidebar shopName={shopName} />
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="min-h-screen">{children}</div>
      </div>
    </div>
  );
}
