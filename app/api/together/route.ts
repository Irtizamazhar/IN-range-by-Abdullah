import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, customerActor, sameOrigin } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => { const c = await customerActor(); return { rooms: await prisma.shoppingRoom.findMany({ where: { members: { some: { customerId: c.id, active: true } } }, select: { id: true, name: true, archived: true, _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, take: 100 }) }; }); }
export async function POST(request: Request) { return api(async () => { sameOrigin(request); const c = await customerActor(); const { name } = z.object({ name: z.string().trim().min(1).max(160) }).parse(await request.json()); return { room: await prisma.shoppingRoom.create({ data: { name, members: { create: { customerId: c.id, role: "OWNER" } } }, select: { id: true } }) }; }); }