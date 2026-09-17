import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { formatTicketNumber, TICKET_PRIORITIES, TICKET_STATUSES, updateTicketAdmin, verifyResourceOwnership } from "@/lib/support-service";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };

export async function GET(_request: Request, { params }: Context) {
  const auth = await requireAdminPermission("support.manage");
  if ("response" in auth) return auth.response;
  return api(async () => {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: params.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        customer: { select: { name: true, email: true } },
        vendor: { select: { shopName: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    let resource: { id: string; label: string } | null = null;
    if (ticket.relatedResourceType && ticket.relatedResourceId) {
      const ownerId = ticket.actorType === "CUSTOMER" ? ticket.customerId : ticket.vendorId;
      resource = ownerId ? await verifyResourceOwnership(ticket.actorType as "CUSTOMER" | "VENDOR", ownerId, ticket.relatedResourceType, ticket.relatedResourceId) : null;
    }
    return {
      ticket: { ...ticket, ticketNumber: formatTicketNumber(ticket.sequence) },
      resource,
      messages: ticket.messages.map(m => ({ id: m.id, senderType: m.senderType, body: m.body, isInternalNote: m.isInternalNote, attachmentUrl: m.attachmentUrl ? `/api/private/support-attachments/${m.id}` : null, createdAt: m.createdAt })),
    };
  });
}

const updateInput = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  reason: z.string().trim().min(3).max(2000),
});

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireAdminPermission("support.manage");
  if ("response" in auth) return auth.response;
  const admin = auth.admin;
  return api(async () => {
    sameOrigin(request); const { reason, ...changes } = updateInput.parse(await request.json());
    if (!Object.keys(changes).length) throw new ApiError(400, "No changes supplied.");
    const ticket = await updateTicketAdmin({ ticketId: params.id, ...changes });
    await writeAdminAudit(prisma, { adminId: admin.id, action: "SUPPORT_TICKET_UPDATED", entityType: "SupportTicket", entityId: params.id, details: { ...changes, reason } });
    return { ticket: { ...ticket, ticketNumber: formatTicketNumber(ticket.sequence) } };
  });
}
