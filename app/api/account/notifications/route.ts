import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, customerActor, sameOrigin } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => { const c = await customerActor(); return { notifications: await prisma.customerNotification.findMany({ where: { customerId: c.id }, select: { id: true, title: true, message: true, href: true, isRead: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 }) }; }); }
export async function PATCH(request: Request) { return api(async () => { sameOrigin(request); const c = await customerActor(); const { id } = z.object({ id: z.string() }).parse(await request.json()); await prisma.customerNotification.updateMany({ where: { id, customerId: c.id }, data: { isRead: true } }); return { success: true }; }); }