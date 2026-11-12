import { requireAdminPermission } from "@/lib/admin-rbac";
import { NewsletterSubscribers } from "@/components/admin/NewsletterSubscribers";
import { incrementalFeatures } from "@/lib/incremental-features";
export default async function Page() { const auth = await requireAdminPermission("customers.manage"); if ("response" in auth) return <p>Customer management access required.</p>; return incrementalFeatures().newsletter ? <NewsletterSubscribers /> : <p className="p-6">Newsletter release flag is off.</p>; }
