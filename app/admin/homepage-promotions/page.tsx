import { requireAdminPermission } from "@/lib/admin-rbac";
import { HomepagePromotionManager } from "@/components/admin/HomepagePromotionManager";
import { incrementalFeatures } from "@/lib/incremental-features";
export default async function Page() { const auth = await requireAdminPermission("homepage.manage"); if ("response" in auth) return <p>Homepage access required.</p>; return incrementalFeatures().promotions ? <HomepagePromotionManager /> : <p className="p-6">Promotion release flag is off.</p>; }
