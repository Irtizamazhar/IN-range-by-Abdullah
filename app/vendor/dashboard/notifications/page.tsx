import { redirect } from "next/navigation";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { VendorNotificationsClient } from "./VendorNotificationsClient";

export const dynamic = "force-dynamic";

export default async function VendorNotificationsPage() {
  const row = await getVendorFromSession({ allowUnapproved: true });
  if (!row) redirect("/vendor/login");
  return <VendorNotificationsClient />;
}
