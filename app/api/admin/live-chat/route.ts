import { z } from "zod";
import { api, ApiError } from "@/lib/marketplace-api";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { incrementalFeatures } from "@/lib/incremental-features";
import { featureWrite } from "@/lib/public-feature-security";
import { sendChatMessage } from "@/lib/live-chat-service";
export const dynamic = "force-dynamic";
async function authorized() { const auth = await requireAdminPermission("support.manage"); if ("response" in auth) return auth; if (!incrementalFeatures().chat) throw new ApiError(404, "Live chat release flag is off."); return auth; }
export async function GET(request: Request) { return api(async () => { const auth = await authorized(); if ("response" in auth) return auth.response; const url = new URL(request.url), id = url.searchParams.get("id"), q = (url.searchParams.get("q") || "").slice(0,100), status = url.searchParams.get("status");
  if (id) { const ticket = await prisma.supportTicket.findFirst({ where: { id, liveAccess: { isNot: null } }, include: { liveAccess: true, messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200 } } }); if (!ticket) throw new ApiError(404, "Conversation not found."); return { ticket: { ...ticket, messages: ticket.messages.reverse(), liveAccess: ticket.liveAccess ? { name: ticket.liveAccess.name, email: ticket.liveAccess.email, phone: ticket.liveAccess.phone, customerId: ticket.liveAccess.customerId } : null } }; }
  const rows = await prisma.liveChatAccess.findMany({ where: { ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}), ...(status ? { ticket: { status } } : {}) }, select: { id: true, ticketId: true, name: true, email: true, customerId: true, adminReadAt: true, ticket: { select: { status: true, lastActivityAt: true, messages: { where: { senderType: { not: "ADMIN" }, isInternalNote: false }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } } } }, orderBy: { ticket: { lastActivityAt: "desc" } }, take: 100 });
  return { conversations: rows.map(row => ({ ...row, unread: Boolean(row.ticket.messages[0] && row.ticket.messages[0].createdAt > row.adminReadAt) })) };
}); }
export async function POST(request: Request) { return api(async () => { const auth = await authorized(); if ("response" in auth) return auth.response; featureWrite(request); const body = await request.json();
  if (body.action === "presence") { const available = z.boolean().parse(body.available); await prisma.liveChatPresence.upsert({ where: { adminId: auth.admin.id }, create: { adminId: auth.admin.id, available, expiresAt: new Date(Date.now() + 90000) }, update: { available, expiresAt: new Date(Date.now() + 90000) } }); return { ok: true }; }
  const id = z.string().min(1).max(191).parse(body.ticketId); const access = await prisma.liveChatAccess.findUnique({ where: { ticketId: id } }); if (!access) throw new ApiError(404, "Conversation not found.");
  if (body.action === "read") { await prisma.liveChatAccess.update({ where: { id: access.id }, data: { adminReadAt: new Date() } }); return { ok: true }; }
  if (body.action === "status") { const status = z.enum(["OPEN","RESOLVED","CLOSED"]).parse(body.status); await prisma.supportTicket.update({ where: { id }, data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null, closedAt: status === "CLOSED" ? new Date() : null } }); return { ok: true }; }
  if (body.action === "assign") { const staff = await prisma.adminUser.findFirst({ where: { id: z.string().parse(body.adminId), isActive: true } }); if (!staff) throw new ApiError(400, "Choose active support staff."); const { permissionsForRole, normalizePermissions, hasAdminPermission } = await import("@/lib/admin-permissions"); if (!hasAdminPermission([...permissionsForRole(staff.role), ...normalizePermissions(staff.permissions)], "support.manage")) throw new ApiError(403, "Staff member lacks support access."); await prisma.supportTicket.update({ where: { id }, data: { assignedToId: staff.id } }); return { ok: true }; }
  return { message: await sendChatMessage(id, { type: "ADMIN", id: auth.admin.id }, body, body.internal === true) };
}); }
