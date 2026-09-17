import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { formatTicketNumber, reopenTicket } from "@/lib/support-service";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };

export async function POST(request: Request, { params }: Context) { return api(async () => {
  sameOrigin(request); const session = await getVendorFromSession();
  if (!session) throw new ApiError(401, "Please sign in as a vendor.");
  const ticket = await reopenTicket("VENDOR", session.vendor.id, params.id);
  return { ticket: { ...ticket, ticketNumber: formatTicketNumber(ticket.sequence) } };
}); }
