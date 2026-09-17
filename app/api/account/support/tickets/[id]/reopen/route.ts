import { api, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { formatTicketNumber, reopenTicket } from "@/lib/support-service";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };

export async function POST(request: Request, { params }: Context) { return api(async () => {
  sameOrigin(request); const customer = await customerActor();
  const ticket = await reopenTicket("CUSTOMER", customer.id, params.id);
  return { ticket: { ...ticket, ticketNumber: formatTicketNumber(ticket.sequence) } };
}); }
