import { prisma } from "@/lib/prisma";
import { api, ApiError } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { formatTicketNumber, publicMessageWhere } from "@/lib/support-service";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };

export async function GET(_request: Request, { params }: Context) { return api(async () => {
  const session = await getVendorFromSession();
  if (!session) throw new ApiError(401, "Please sign in as a vendor.");
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: params.id, actorType: "VENDOR", vendorId: session.vendor.id },
    include: { messages: { where: publicMessageWhere, orderBy: { createdAt: "asc" } } },
  });
  if (!ticket) throw new ApiError(404, "Ticket not found.");
  const { messages, customerId: _customerId, vendorId: _vendorId, ...ticketFields } = ticket; void _customerId; void _vendorId;
  return {
    ticket: { ...ticketFields, ticketNumber: formatTicketNumber(ticket.sequence) },
    messages: messages.map(m => ({ id: m.id, senderType: m.senderType, body: m.body, attachmentUrl: m.attachmentUrl ? `/api/private/support-attachments/${m.id}` : null, createdAt: m.createdAt })),
  };
}); }
