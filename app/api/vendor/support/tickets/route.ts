import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { consumeOrReject, createSupportTicketRateLimiter } from "@/lib/security/rate-limit";
import { parseSupportAttachment } from "@/lib/support-attachment";
import { clampPage, createTicketInput, createSupportTicket, formatTicketNumber, statusesForFilter, ticketListSelect } from "@/lib/support-service";
export const dynamic = "force-dynamic";

const ticketLimiter = createSupportTicketRateLimiter();

async function requireVendor() {
  const session = await getVendorFromSession();
  if (!session) throw new ApiError(401, "Please sign in as a vendor.");
  return session.vendor;
}

export async function GET(request: Request) { return api(async () => {
  const vendor = await requireVendor();
  const { searchParams } = new URL(request.url);
  const statuses = statusesForFilter(searchParams.get("filter") || "all");
  const { page, pageSize, skip, take } = clampPage(searchParams.get("page"), searchParams.get("pageSize"));
  const where = { actorType: "VENDOR", vendorId: vendor.id, ...(statuses ? { status: { in: statuses } } : {}) };
  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({ where, select: ticketListSelect, orderBy: { lastActivityAt: "desc" }, skip, take }),
    prisma.supportTicket.count({ where }),
  ]);
  return { tickets: rows.map(t => ({ ...t, ticketNumber: formatTicketNumber(t.sequence) })), page, pageSize, total };
}); }

export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); const vendor = await requireVendor();
  const limited = await consumeOrReject(ticketLimiter, `support-ticket:VENDOR:${vendor.id}`);
  if (!limited.ok) throw new ApiError(429, "Too many tickets created recently. Please try again later.");
  const form = await request.formData();
  const input = createTicketInput.parse({
    category: form.get("category"), subject: form.get("subject"), message: form.get("message"),
    relatedResourceType: form.get("relatedResourceType") || null, relatedResourceId: form.get("relatedResourceId") || null,
  });
  const attachment = await parseSupportAttachment(form).catch(e => { throw new ApiError(400, e instanceof Error ? e.message : "Invalid attachment."); });
  const ticket = await createSupportTicket({ actorType: "VENDOR", actorId: vendor.id, actorEmail: vendor.email, ...input, attachment });
  return { ticket: { ...ticket, ticketNumber: formatTicketNumber(ticket.sequence) } };
}); }
