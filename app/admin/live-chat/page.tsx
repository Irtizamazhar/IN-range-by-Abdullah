import { requireAdminPermission } from "@/lib/admin-rbac";
import { LiveChatInbox } from "@/components/admin/LiveChatInbox";
import { incrementalFeatures } from "@/lib/incremental-features";
export default async function Page() { const auth = await requireAdminPermission("support.manage"); if ("response" in auth) return <p>Support access required.</p>; return incrementalFeatures().chat ? <LiveChatInbox /> : <p className="p-6">Live chat is disabled until its migration and release checks are complete.</p>; }
