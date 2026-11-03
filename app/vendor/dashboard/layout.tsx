import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { prisma } from "@/lib/prisma";
import { VendorProtectedRoute } from "@/components/vendor/VendorProtectedRoute";
import { VendorChrome } from "@/components/vendor/VendorChrome";
import { vendorWelcomeDisplayName } from "@/lib/vendor-display-name";

export const dynamic = "force-dynamic";

export default async function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const row = await getVendorFromSession({ allowUnapproved: true });
  if (!row) {
    redirect("/vendor/login");
  }

  if (row.vendor.status !== "approved") redirect(row.vendor.status === "onboarding" ? "/vendor/onboarding" : "/vendor/status");
  const branding = await prisma.vendor.findUnique({ where: { id: row.vendor.id }, select: { shopLogo: true } });

  return (
    <VendorProtectedRoute>
      <VendorChrome shopName={row.vendor.shopName} ownerName={vendorWelcomeDisplayName(row.vendor.ownerName)} shopLogo={branding?.shopLogo || null}>{children}</VendorChrome>
    </VendorProtectedRoute>
  );
}
