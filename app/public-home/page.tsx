import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonScreen } from "@/components/coming-soon-gate/ComingSoonScreen";
import { isMaintenanceMode } from "@/lib/private-launch/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "JORO.pk | Pakistan Marketplace",
  description: "JORO is a Pakistan-focused marketplace for discovering products, services and gifts, posting Wants and connecting with sellers. The marketplace is in private launch.",
  alternates: { canonical: "https://joro.pk" },
};

export default function PublicHomePage() {
  if (!isMaintenanceMode()) notFound();
  return <ComingSoonScreen publicHomepage />;
}
