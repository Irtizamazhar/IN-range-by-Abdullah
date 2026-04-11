import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function VendorSettingsPage() {
  const row = await getVendorFromSession();
  if (!row) redirect("/vendor/login");
  if (row.vendor.status !== "approved") {
    redirect("/vendor/dashboard");
  }
  return <SettingsClient />;
}
