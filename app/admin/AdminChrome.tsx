"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

function AdminChromeInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }
  return <AdminShell>{children}</AdminShell>;
}

export function AdminChrome({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="admin-ui h-[100dvh] bg-admin-bg">
          <div className="flex h-full overflow-hidden">
            <aside className="hidden w-64 shrink-0 bg-admin-dark md:block" aria-hidden />
            <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
          </div>
        </div>
      }
    >
      <AdminChromeInner>{children}</AdminChromeInner>
    </Suspense>
  );
}
