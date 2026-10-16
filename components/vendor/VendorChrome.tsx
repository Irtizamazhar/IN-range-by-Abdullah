"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { VendorTopbar } from "@/components/vendor/VendorTopbar";
import { DashboardShell } from "@/components/DashboardShell";

export function VendorChrome({
  shopName,
  ownerName,
  children,
}: {
  shopName: string;
  ownerName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vendor/notifications", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { unread?: number } | null) => {
        if (!cancelled && data) setUnread(Math.max(0, Number(data.unread ?? 0) || 0));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);

  return (
    <DashboardShell
      label="Vendor"
      className="vendor-ui"
      collapseKey="vendor_sidebar_collapsed"
      topbar={<VendorTopbar ownerName={ownerName} shopName={shopName} unreadNotifications={unread} />}
      sidebar={(collapsed) => (
        <Suspense
          fallback={
            <aside
              className="hidden h-full w-full shrink-0 bg-admin-dark text-white lg:block"
              aria-hidden
            />
          }
        >
          <VendorSidebar unreadNotifications={unread} collapsed={collapsed} />
        </Suspense>
      )}
    >
      <div className="min-h-full">{children}</div>
    </DashboardShell>
  );
}
