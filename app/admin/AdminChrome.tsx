"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/Sidebar";

function AdminChromeInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }
  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

export function AdminChrome({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8F9FA]">
          <div className="flex min-h-screen">
            <aside className="w-64 shrink-0 bg-footerDark" aria-hidden />
            <div className="flex-1 overflow-auto">{children}</div>
          </div>
        </div>
      }
    >
      <AdminChromeInner>{children}</AdminChromeInner>
    </Suspense>
  );
}
