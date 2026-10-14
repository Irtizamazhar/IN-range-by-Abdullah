"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import Link from "@/components/ui/LoadingLink";

const POLL_MS = 60_000;

/**
 * Header bell with the customer's unread notification count (offers, Want moderation, orders…).
 * It polls a count-only endpoint every minute while the tab is visible — not live push.
 */
export function CustomerNotificationBell() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const customerId = session?.user?.role === "customer" ? session.user.id : "";
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!customerId) { setUnread(0); return; }
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/customer/notifications/unread", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return;
        const data = await response.json() as { unread?: number };
        if (!cancelled) setUnread(Math.max(0, Number(data.unread) || 0));
      } catch { /* keep the last known count */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [customerId, pathname]);

  if (!customerId) return null;
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";
  return <Link href="/account/notifications" aria-label={label} title={label}
    className="group relative flex h-11 items-center rounded-xl px-2 text-brand-link focus-visible:outline-brand-link sm:px-2.5">
    <Bell className="h-[19px] w-[19px] transition-transform group-hover:scale-105" aria-hidden="true" />
    {unread > 0 && <span className="absolute right-0 top-0 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#005235] px-1 text-[11px] font-black text-white ring-2 ring-white">{unread > 99 ? "99+" : unread}</span>}
  </Link>;
}
