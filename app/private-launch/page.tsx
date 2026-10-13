import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComingSoonScreen } from "@/components/coming-soon-gate/ComingSoonScreen";
import { isMaintenanceMode } from "@/lib/private-launch/session";

// Reads MAINTENANCE_MODE at request time, never at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coming Soon",
  description: "We're working on something exciting. JORO.pk is coming soon.",
  robots: { index: false, follow: false },
};

/**
 * Served by middleware (as a rewrite) for every page while MAINTENANCE_MODE=true
 * and the visitor has no team preview session.
 */
export default function PrivateLaunchPage() {
  if (!isMaintenanceMode()) notFound();
  return <ComingSoonScreen />;
}
