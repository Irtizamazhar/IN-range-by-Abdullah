import { prisma } from "@/lib/prisma";
import { api, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { safeAccountLink } from "@/lib/customer-account-policy";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => {
  const c = await customerActor(); const [notifications, unread] = await Promise.all([
    prisma.customerNotification.findMany({ where: { customerId: c.id }, select: { id: true, type: true, title: true, message: true, link: true, isRead: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 150 }),
    prisma.customerNotification.count({ where: { customerId: c.id, isRead: false } }),
  ]); return { unread, notifications: notifications.map(n => ({ ...n, link: safeAccountLink(n.link) })) };
}); }
export async function PATCH(request: Request) { return api(async () => { sameOrigin(request); const c = await customerActor(); await prisma.customerNotification.updateMany({ where: { customerId: c.id, isRead: false }, data: { isRead: true } }); return { ok: true }; }); }