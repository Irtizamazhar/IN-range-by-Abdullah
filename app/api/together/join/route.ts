import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); const c = await customerActor(); const { token } = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(await request.json());
  return prisma.$transaction(async tx => {
    const invite = await tx.roomInvite.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") }, include: { room: { select: { archived: true } } } });
    if (!invite || invite.revoked || invite.expiresAt <= new Date() || invite.room.archived) throw new ApiError(404, "Invitation expired or revoked.");
    const existing = await tx.roomMember.findUnique({ where: { roomId_customerId: { roomId: invite.roomId, customerId: c.id } } });
    if (existing && !existing.active) throw new ApiError(403, "The room owner removed your access.");
    await tx.roomMember.upsert({ where: { roomId_customerId: { roomId: invite.roomId, customerId: c.id } }, create: { roomId: invite.roomId, customerId: c.id }, update: {} });
    return { roomId: invite.roomId };
  }, { isolationLevel: "Serializable" });
}); }