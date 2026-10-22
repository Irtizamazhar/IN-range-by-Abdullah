import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, customerActor, sameOrigin } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => {
  const c = await customerActor();
  const rooms = await prisma.shoppingRoom.findMany({ where: { members: { some: { customerId: c.id, active: true } } }, select: { id: true, name: true, archived: true, createdAt: true, members: { where: { customerId: c.id, active: true }, select: { role: true } }, _count: { select: { items: true, members: { where: { active: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 });
  // Avatars and owner name for the room cards; only for rooms this customer is an active member of.
  const people = rooms.length ? await prisma.roomMember.findMany({ where: { roomId: { in: rooms.map(r => r.id) }, active: true }, select: { roomId: true, role: true, customer: { select: { name: true, image: true } } }, orderBy: { createdAt: "asc" } }) : [];
  return { rooms: rooms.map(room => {
    const members = people.filter(p => p.roomId === room.id);
    return { ...room, ownerName: members.find(p => p.role === "OWNER")?.customer.name ?? null, memberPreview: members.slice(0, 4).map(p => ({ name: p.customer.name, image: p.customer.image })) };
  }) };
}); }
export async function POST(request: Request) { return api(async () => { sameOrigin(request); const c = await customerActor(); const { name } = z.object({ name: z.string().trim().min(1).max(160) }).parse(await request.json()); return { room: await prisma.shoppingRoom.create({ data: { name, members: { create: { customerId: c.id, role: "OWNER" } } }, select: { id: true } }) }; }); }
