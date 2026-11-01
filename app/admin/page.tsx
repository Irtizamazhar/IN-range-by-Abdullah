import { notFound, redirect } from "next/navigation";
import { adminUrl } from "@/lib/admin-path";

/** The admin root has no page of its own — send it to the dashboard. Unauthenticated
 * users get bounced to the admin login by middleware before this renders. */
export default function AdminIndexPage() {
  const dashboard = adminUrl("/dashboard");
  if (!dashboard) notFound();
  redirect(dashboard);
}
