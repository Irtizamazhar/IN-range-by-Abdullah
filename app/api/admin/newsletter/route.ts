import { api } from "@/lib/marketplace-api";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return api(async () => { const auth = await requireAdminPermission("customers.manage"); if ("response" in auth) return auth.response; const status = new URL(request.url).searchParams.get("status"); const [subscribers, counts] = await Promise.all([prisma.newsletterSubscription.findMany({ where: { ...(status && ["PENDING","SUBSCRIBED","UNSUBSCRIBED"].includes(status) ? { status } : {}) }, select: { id: true, email: true, status: true, consentAt: true, confirmedAt: true, unsubscribedAt: true }, orderBy: { createdAt: "desc" }, take: 200 }), prisma.newsletterSubscription.groupBy({ by: ["status"], _count: { _all: true } })]); return { subscribers, counts }; }); }
