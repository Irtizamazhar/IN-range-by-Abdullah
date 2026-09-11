import { redirect } from "next/navigation";

/** `/admin` has no page of its own — send it to the dashboard. Unauthenticated
 * users get bounced to `/admin/login` by middleware before this renders. */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
