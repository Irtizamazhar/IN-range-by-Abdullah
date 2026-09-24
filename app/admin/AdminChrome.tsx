"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/Sidebar";
import { DashboardShell } from "@/components/DashboardShell";

function AdminChromeInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }
  return (
    <DashboardShell label="Admin" sidebar={<AdminSidebar />}>
      {children}
    </DashboardShell>
  );
}

export function AdminChrome({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] bg-brand-background">
          <div className="flex h-full overflow-hidden">
            <aside className="hidden w-64 shrink-0 bg-footerDark md:block" aria-hidden />
            <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
          </div>
        </div>
      }
    >
      <AdminChromeInner>{children}</AdminChromeInner>
    </Suspense>
  );
}
