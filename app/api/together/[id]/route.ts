import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { roomMember, canonicalCartLine, roomCommentText, roomProductSelect, roomProductImage } from "@/lib/family-cart-service";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
export async function GET(_request: Request, { params }: Context) { return api(async () => {
  const c = await customerActor(); const member = await roomMember(prisma, params.id, c.id);
  const room = await prisma.shoppingRoom.findUnique({ where: { id: params.id }, select: { id: true, name: true, archived: true, members: { where: { active: true }, select: { id: true, role: true, customer: { select: { name: true } } } }, items: { select: { id: true, productId: true, quantity: true, variant: true, member: { select: { customer: { select: { name: true } } } }, product: { select: roomProductSelect }, comments: { select: { id: true, text: true, memberId: true, createdAt: true, member: { select: { customer: { select: { name: true } } } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }, orderBy: { createdAt: "desc" }, take: 100 } } });
  return { room: room && { ...room, items: room.items.map(item => ({ ...item, product: { ...item.product, image: roomProductImage(item.product) } })) }, memberId: member.id, owner: member.role === "OWNER" };
}); }
export async function POST(request: Request, { params }: Context) { return api(async () => {
  sameOrigin(request); const c = await customerActor(); const body = await request.json(); const action = z.enum(["invite", "revoke", "rename", "archive", "removeMember", "add", "remove", "comment", "editComment", "deleteComment", "cart"]).parse(body.action);
  return prisma.$transaction(async tx => {
    const member = await roomMember(tx, params.id, c.id); if (member.room.archived) throw new ApiError(409, "This room is archived.");
    if (["invite", "revoke", "rename", "archive", "removeMember", "remove"].includes(action) && member.role !== "OWNER") throw new ApiError(403, "Only the room owner can do this.");
    if (action === "invite") { const token = randomBytes(32).toString("hex"); await tx.roomInvite.create({ data: { roomId: params.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 7 * 86400000) } }); return { invitePath: `/join/${token}` }; }
    if (action === "revoke") { await tx.roomInvite.updateMany({ where: { roomId: params.id }, data: { revoked: true } }); return { success: true }; }
    if (action === "archive") { await tx.shoppingRoom.update({ where: { id: params.id }, data: { archived: true } }); return { success: true }; }
    if (action === "rename") { await tx.shoppingRoom.update({ where: { id: params.id }, data: { name: z.string().trim().min(1).max(160).parse(body.name) } }); return { success: true }; }
    if (action === "removeMember") { await tx.roomMember.updateMany({ where: { id: String(body.memberId), roomId: params.id, role: "MEMBER" }, data: { active: false } }); return { success: true }; }
    if (action === "add") {
      const input = z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(1000), variant: z.string().max(200).default("") }).parse(body);
      const line = await canonicalCartLine(tx, input.productId, input.quantity, input.variant);
      const existing = await tx.roomItem.findFirst({ where: { roomId: params.id, productId: input.productId, variant: input.variant } });
      if (existing) return { success: true, alreadyShared: true };
      await tx.roomItem.create({ data: { ...input, roomId: params.id, memberId: member.id, priceAtAddition: line.price } }); return { success: true };
    }
    if (action === "cart") {
      const ids = z.array(z.string()).min(1).max(50).parse(body.itemIds); const uniqueIds = Array.from(new Set(ids));
      const items = await tx.roomItem.findMany({ where: { id: { in: uniqueIds }, roomId: params.id } }); if (items.length !== uniqueIds.length) throw new ApiError(404, "Room item not found.");
      return { lines: await Promise.all(items.map(item => canonicalCartLine(tx, item.productId, z.number().int().min(1).max(1000).parse(body.quantity ?? item.quantity), item.variant))) };
    }
    const itemId = z.string().min(1).parse(body.itemId); if (!await tx.roomItem.findFirst({ where: { id: itemId, roomId: params.id }, select: { id: true } })) throw new ApiError(404, "Room item not found.");
    if (action === "remove") await tx.roomItem.delete({ where: { id: itemId } });
    if (action === "comment") await tx.roomComment.create({ data: { memberId: member.id, itemId, text: roomCommentText.parse(body.text) } });
    if (action === "editComment" || action === "deleteComment") {
      const where = { id: z.string().min(1).parse(body.commentId), itemId, memberId: member.id };
      const result = action === "editComment"
        ? await tx.roomComment.updateMany({ where, data: { text: roomCommentText.parse(body.text) } })
        : await tx.roomComment.deleteMany({ where });
      if (!result.count) throw new ApiError(404, "Comment not found.");
    }
    return { success: true };
  }, { isolationLevel: "Serializable" });
}); }
