import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/marketplace-api";
import { getCustomerSession } from "@/lib/sessions";
import { privateCookie, tokenHash } from "@/lib/public-feature-security";
export const CHAT_COOKIE = "joro_live_chat";
export const chatMessageInput = z.object({ message: z.string().trim().min(1).max(3000), clientKey: z.string().uuid() });
export const chatStartInput = z.object({ name: z.string().trim().min(2).max(120).optional(), email: z.string().trim().email().max(254).optional(), phone: z.string().trim().max(40).optional() });
export async function chatAccess() {
  const token = privateCookie(CHAT_COOKIE);
  if (!token) throw new ApiError(401, "Start a support conversation first.");
  const access = await prisma.liveChatAccess.findUnique({ where: { tokenHash: tokenHash(token) }, include: { ticket: true } });
  if (!access || access.expiresAt <= new Date()) throw new ApiError(401, "Your conversation access has expired. Please start a new conversation.");
  if (access.customerId) {
    const session = await getCustomerSession();
    if (session?.user?.role !== "customer" || session.user.id !== access.customerId || !await prisma.customer.findFirst({ where: { id: access.customerId, isActive: true }, select: { id: true } })) throw new ApiError(401, "Please sign in to access your conversation.");
  }
  return access;
}
export const publicChatMessageSelect = { id: true, body: true, senderType: true, createdAt: true } as const;
export async function sendChatMessage(ticketId: string, actor: { type: string; id: string }, input: unknown, internal = false) {
  const body = chatMessageInput.parse(input), key = tokenHash(`${ticketId}:${actor.type}:${actor.id}:${body.clientKey}`);
  return prisma.$transaction(async tx => {
    const previous = await tx.liveChatReceipt.findUnique({ where: { key }, include: { message: { select: publicChatMessageSelect } } });
    if (previous) return previous.message;
    const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.status === "CLOSED" || (!internal && actor.type !== "ADMIN" && ticket.status === "RESOLVED")) throw new ApiError(409, "This conversation is resolved. Reopen it before sending.");
    const message = await tx.supportMessage.create({ data: { ticketId, senderType: actor.type, senderId: actor.id, body: body.message, isInternalNote: internal }, select: publicChatMessageSelect });
    await tx.liveChatReceipt.create({ data: { key, messageId: message.id } });
    await tx.supportTicket.update({ where: { id: ticketId }, data: { lastActivityAt: new Date(), ...(!internal ? { status: actor.type === "ADMIN" ? "WAITING_FOR_CUSTOMER" : "CUSTOMER_REPLIED" } : {}) } });
    return message;
  });
}
