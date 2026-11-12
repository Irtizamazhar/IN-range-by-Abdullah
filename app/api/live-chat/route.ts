import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/marketplace-api";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/sessions";
import { incrementalFeatures } from "@/lib/incremental-features";
import { featureWrite, featureRate, requestAddress, newPrivateToken, tokenHash, privateCookieOptions } from "@/lib/public-feature-security";
import { CHAT_COOKIE, chatAccess, chatStartInput, publicChatMessageSelect, sendChatMessage } from "@/lib/live-chat-service";
export const dynamic = "force-dynamic";
function enabled() { if (!incrementalFeatures().chat) throw new ApiError(404, "Live support is not available yet."); }
export async function GET() { return api(async () => { enabled(); const access = await chatAccess(); const readThrough = new Date(); const [messages, online, unreadCount] = await Promise.all([prisma.supportMessage.findMany({ where: { ticketId: access.ticketId, isInternalNote: false }, select: publicChatMessageSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 }), prisma.liveChatPresence.count({ where: { available: true, expiresAt: { gt: new Date() } } }), prisma.supportMessage.count({ where: { ticketId: access.ticketId, senderType: "ADMIN", isInternalNote: false, createdAt: { gt: access.visitorReadAt, lte: readThrough } } })]); return { unreadCount, readThrough, messages: messages.reverse(), status: access.ticket.status, available: online > 0, expiresAt: access.expiresAt }; }); }
export async function POST(request: Request) { return api(async () => {
  enabled(); featureWrite(request); const body = await request.json();
  if (body.action === "start") {
    await featureRate("chat-start", requestAddress(request), 5, 3600);
    const input = chatStartInput.parse(body), session = await getCustomerSession();
    const customer = session?.user?.role === "customer" && session.user.id ? await prisma.customer.findFirst({ where: { id: session.user.id, isActive: true }, select: { id: true, name: true, email: true } }) : null;
    const name = customer?.name || input.name, email = customer?.email || input.email;
    if (!name || !email) throw new ApiError(400, "Please enter your name and email.");
    const token = newPrivateToken();
    const ticket = await prisma.supportTicket.create({ data: { actorType: customer ? "CUSTOMER" : "GUEST", customerId: customer?.id, category: "OTHER", subject: "Live customer support", liveAccess: { create: { tokenHash: tokenHash(token), customerId: customer?.id, name, email, phone: input.phone, expiresAt: new Date(Date.now() + 30 * 86400000) } } }, select: { id: true } });
    const response = NextResponse.json({ ok: true, ticketId: ticket.id }); response.cookies.set(CHAT_COOKIE, token, privateCookieOptions); return response;
  }
  const access = await chatAccess();
  if (body.action === "read") { await featureRate("chat-read", access.id, 60, 60); const through = body.through ? new Date(body.through) : new Date(); if (!Number.isFinite(through.getTime()) || through > new Date()) throw new ApiError(400, "Invalid read marker."); await prisma.liveChatAccess.updateMany({ where: { id: access.id, visitorReadAt: { lt: through } }, data: { visitorReadAt: through } }); return { ok: true }; }
  await featureRate("chat-message", access.id, 30, 600);
  if (body.action === "reopen") { await prisma.supportTicket.update({ where: { id: access.ticketId }, data: { status: "OPEN", resolvedAt: null, closedAt: null } }); return { ok: true }; }
  const message = await sendChatMessage(access.ticketId, { type: access.customerId ? "CUSTOMER" : "GUEST", id: access.customerId || access.id }, body);
  return { message };
}); }


