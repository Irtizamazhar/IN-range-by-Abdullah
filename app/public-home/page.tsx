import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonScreen } from "@/components/coming-soon-gate/ComingSoonScreen";
import { isMaintenanceMode } from "@/lib/private-launch/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "JORO.PK ? temporarily unavailable",
  description: "JORO.PK is temporarily unavailable for maintenance. Please check back shortly.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://joro.pk" },
};

export default function PublicHomePage() {
  if (!isMaintenanceMode()) notFound();
  return <ComingSoonScreen publicHomepage />;
}
