import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { VendorProtectedRoute } from "@/components/vendor/VendorProtectedRoute";
import { VendorChrome } from "@/components/vendor/VendorChrome";

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

  return (
    <VendorProtectedRoute>
      <VendorChrome shopName={row.vendor.shopName}>{children}</VendorChrome>
    </VendorProtectedRoute>
  );
}
