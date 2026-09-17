import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/marketplace-api";
import { notifyCustomer, notifyVendor } from "@/lib/marketplace-notifications";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { saveSupportAttachment, type ParsedAttachment } from "@/lib/support-attachment";
import { isMailConfigured, sendMail } from "@/lib/mailer";

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "CUSTOMER_REPLIED", "RESOLVED", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export const ACTOR_TYPES = ["CUSTOMER", "VENDOR"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/** JORO-10482 style friendly ticket numbers, derived from the autoincrement sequence -- never stored twice. */
export function formatTicketNumber(sequence: number): string {
  return `JORO-${10000 + sequence}`;
}

export const CUSTOMER_CATEGORIES = [
  ["ORDERS_DELIVERY", "Orders & Delivery"], ["PAYMENT", "Payment"], ["RETURN_REFUND", "Return / Refund"],
  ["PRODUCT_ISSUE", "Product Issue"], ["WANTS_OFFERS", "Wants & Offers"], ["SERVICES", "Services"],
  ["FAMILY_CART", "Family Cart"], ["ACCOUNT", "Account"], ["SELLER_ISSUE", "Seller Issue"], ["OTHER", "Other"],
] as const;
export const VENDOR_CATEGORIES = [
  ["ORDERS", "Orders"], ["PRODUCTS", "Products"], ["STORE", "Store"], ["WANTS_OFFERS", "Wants / Offers"],
  ["SERVICES", "Services"], ["EARNINGS_WITHDRAWALS", "Earnings / Withdrawals"], ["ACCOUNT_VERIFICATION", "Account / Verification"],
  ["PROMOTIONS_TOP_VENDOR", "Promotions / Top Vendor"], ["TECHNICAL", "Technical Issue"], ["OTHER", "Other"],
] as const;
export function categoryLabel(actorType: ActorType, value: string): string {
  const list = actorType === "CUSTOMER" ? CUSTOMER_CATEGORIES : VENDOR_CATEGORIES;
  return list.find(([v]) => v === value)?.[1] || value;
}
export function isValidCategory(actorType: ActorType, value: string): boolean {
  const list = actorType === "CUSTOMER" ? CUSTOMER_CATEGORIES : VENDOR_CATEGORIES;
  return list.some(([v]) => v === value);
}
export function ticketHref(actorType: ActorType, ticketId: string): string {
  return actorType === "CUSTOMER" ? `/account/help/tickets/${ticketId}` : `/vendor/dashboard/help/tickets/${ticketId}`;
}

export const CUSTOMER_RESOURCE_TYPES = ["ORDER", "WANT", "WANT_OFFER", "SERVICE_BOOKING", "RETURN_REQUEST"] as const;
export const VENDOR_RESOURCE_TYPES = ["VENDOR_SHOP_ORDER", "WANT_OFFER", "SERVICE_BOOKING", "WITHDRAWAL", "PRODUCT"] as const;
export type ResourceType = (typeof CUSTOMER_RESOURCE_TYPES)[number] | (typeof VENDOR_RESOURCE_TYPES)[number];

/** Every entry re-verifies ownership server-side; the client only ever supplies an id to check. */
const RESOURCE_VERIFIERS: Record<ActorType, Partial<Record<ResourceType, (actorId: string, id: string) => Promise<{ id: string; label: string } | null>>>> = {
  CUSTOMER: {
    ORDER: async (customerId, id) => {
      const row = await prisma.order.findFirst({ where: { id, customerId }, select: { id: true, orderNumber: true } });
      return row ? { id: row.id, label: `Order ${row.orderNumber}` } : null;
    },
    WANT: async (customerId, id) => {
      const row = await prisma.want.findFirst({ where: { id, customerId }, select: { id: true, title: true } });
      return row ? { id: row.id, label: row.title } : null;
    },
    WANT_OFFER: async (customerId, id) => {
      const row = await prisma.wantOffer.findFirst({ where: { id, want: { customerId } }, select: { id: true, want: { select: { title: true } } } });
      return row ? { id: row.id, label: `Offer on "${row.want.title}"` } : null;
    },
    SERVICE_BOOKING: async (customerId, id) => {
      const row = await prisma.orderService.findFirst({ where: { id, order: { customerId } }, select: { id: true, order: { select: { orderNumber: true } } } });
      return row ? { id: row.id, label: `Service booking (${row.order.orderNumber})` } : null;
    },
    RETURN_REQUEST: async (customerId, id) => {
      const row = await prisma.returnRequest.findFirst({ where: { id, customerId }, select: { id: true, reason: true } });
      return row ? { id: row.id, label: `Return: ${row.reason}` } : null;
    },
  },
  VENDOR: {
    VENDOR_SHOP_ORDER: async (vendorId, id) => {
      const row = await prisma.vendorShopOrder.findFirst({ where: { id, vendorId }, select: { id: true, shopOrderNumber: true } });
      return row ? { id: row.id, label: `Order ${row.shopOrderNumber}` } : null;
    },
    WANT_OFFER: async (vendorId, id) => {
      const row = await prisma.wantOffer.findFirst({ where: { id, vendorId }, select: { id: true, want: { select: { title: true } } } });
      return row ? { id: row.id, label: `Offer on "${row.want.title}"` } : null;
    },
    SERVICE_BOOKING: async (vendorId, id) => {
      const row = await prisma.orderService.findFirst({ where: { id, vendorId }, select: { id: true, order: { select: { orderNumber: true } } } });
      return row ? { id: row.id, label: `Service booking (${row.order.orderNumber})` } : null;
    },
    WITHDRAWAL: async (vendorId, id) => {
      const row = await prisma.vendorWithdrawal.findFirst({ where: { id, vendorId }, select: { id: true, requestedAmount: true } });
      return row ? { id: row.id, label: `Withdrawal PKR ${row.requestedAmount.toString()}` } : null;
    },
    PRODUCT: async (vendorId, id) => {
      const row = await prisma.vendorProduct.findFirst({ where: { id, vendorId }, select: { id: true, productName: true } });
      return row ? { id: row.id, label: row.productName } : null;
    },
  },
};

/** Returns a safe display label if (and only if) the actor actually owns the resource; never trusts the client. */
export async function verifyResourceOwnership(actorType: ActorType, actorId: string, resourceType: string, resourceId: string) {
  const verifier = RESOURCE_VERIFIERS[actorType]?.[resourceType as ResourceType];
  if (!verifier) return null;
  return verifier(actorId, resourceId);
}

/** Small "pick one of your own X" lists for the ticket-creation resource selector. */
export async function listOwnResources(actorType: ActorType, actorId: string, resourceType: string, limit = 20) {
  if (actorType === "CUSTOMER") {
    switch (resourceType) {
      case "ORDER": return (await prisma.order.findMany({ where: { customerId: actorId }, select: { id: true, orderNumber: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: limit })).map(r => ({ id: r.id, label: `Order ${r.orderNumber}` }));
      case "WANT": return (await prisma.want.findMany({ where: { customerId: actorId }, select: { id: true, title: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: limit })).map(r => ({ id: r.id, label: r.title }));
      case "WANT_OFFER": return (await prisma.wantOffer.findMany({ where: { want: { customerId: actorId } }, select: { id: true, want: { select: { title: true } }, createdAt: true }, orderBy: { createdAt: "desc" }, take: limit })).map(r => ({ id: r.id, label: `Offer on "${r.want.title}"` }));
      case "SERVICE_BOOKING": return (await prisma.orderService.findMany({ where: { order: { customerId: actorId } }, select: { id: true, order: { select: { orderNumber: true } }, createdAt: true }, orderBy: { createdAt: "desc" }, take: limit })).map(r => ({ id: r.id, label: `Service booking (${r.order.orderNumber})` }));
      case "RETURN_REQUEST": return (await prisma.returnRequest.findMany({ where: { customerId: actorId }, select: { id: true, reason: true, requestedAt: true }, orderBy: { requestedAt: "desc" }, take: limit })).map(r => ({ id: r.id, label: `Return: ${r.reason}` }));
      default: return [];
    }
  }
  switch (resourceType) {
    case "VENDOR_SHOP_ORDER": return (await prisma.vendorShopOrder.findMany({ where: { vendorId: actorId }, select: { id: true, shopOrderNumber: true, placedAt: true }, orderBy: { placedAt: "desc" }, take: limit })).map(r => ({ id: r.id, label: `Order ${r.shopOrderNumber}` }));
    case "WANT_OFFER": return (await prisma.wantOffer.findMany({ where: { vendorId: actorId }, select: { id: true, want: { select: { title: true } }, createdAt: true }, orderBy: { createdAt: "desc" }, take: limit })).map(r => ({ id: r.id, label: `Offer on "${r.want.title}"` }));
    case "SERVICE_BOOKING": return (await prisma.orderService.findMany({ where: { vendorId: actorId }, select: { id: true, order: { select: { orderNumber: true } }, createdAt: true }, orderBy: { createdAt: "desc" }, take: limit })).map(r => ({ id: r.id, label: `Service booking (${r.order.orderNumber})` }));
    case "WITHDRAWAL": return (await prisma.vendorWithdrawal.findMany({ where: { vendorId: actorId }, select: { id: true, requestedAmount: true, requestedAt: true }, orderBy: { requestedAt: "desc" }, take: limit })).map(r => ({ id: r.id, label: `Withdrawal PKR ${r.requestedAmount.toString()}` }));
    case "PRODUCT": return (await prisma.vendorProduct.findMany({ where: { vendorId: actorId }, select: { id: true, productName: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: limit })).map(r => ({ id: r.id, label: r.productName }));
    default: return [];
  }
}

export const createTicketInput = z.object({
  category: z.string().trim().min(1).max(60),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(3).max(5000),
  relatedResourceType: z.string().trim().max(40).optional().nullable(),
  relatedResourceId: z.string().trim().max(191).optional().nullable(),
});
export const createMessageInput = z.object({ body: z.string().trim().min(1).max(5000) });

/** Every status change is admin-controlled except the automatic CUSTOMER_REPLIED bump below. */
export function isValidStatus(value: unknown): value is TicketStatus { return TICKET_STATUSES.includes(value as TicketStatus); }
export function isValidPriority(value: unknown): value is TicketPriority { return TICKET_PRIORITIES.includes(value as TicketPriority); }

/** CUSTOMER_REPLIED means exactly what it says: the owner replied after support had already responded at
 * least once. A brand-new ticket (or one support hasn't touched yet) stays at its current status. */
export function nextStatusOnOwnerMessage(current: TicketStatus, hasSupportReplied: boolean): TicketStatus {
  return hasSupportReplied ? "CUSTOMER_REPLIED" : current;
}

export const LIST_FILTERS = ["all", "open", "waiting", "resolved"] as const;
export type ListFilter = (typeof LIST_FILTERS)[number];
export function statusesForFilter(filter: string): TicketStatus[] | undefined {
  switch (filter) {
    case "open": return ["OPEN", "IN_PROGRESS", "CUSTOMER_REPLIED"];
    case "waiting": return ["WAITING_FOR_CUSTOMER"];
    case "resolved": return ["RESOLVED", "CLOSED"];
    default: return undefined;
  }
}
export function clampPage(pageRaw: unknown, pageSizeRaw: unknown) {
  const page = Math.max(1, Math.floor(Number(pageRaw) || 1));
  const pageSize = Math.min(50, Math.max(5, Math.floor(Number(pageSizeRaw) || 20)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export const ticketListSelect = {
  id: true, sequence: true, actorType: true, category: true, subject: true, status: true, priority: true,
  relatedResourceType: true, relatedResourceId: true, createdAt: true, updatedAt: true, lastActivityAt: true,
} satisfies Prisma.SupportTicketSelect;

/** Public (non-internal) messages only -- used everywhere except the admin ticket detail. */
export const publicMessageWhere = { isInternalNote: false } satisfies Prisma.SupportMessageWhereInput;

async function attachIfPresent(ticketId: string, messageId: string, attachment: ParsedAttachment | null | undefined) {
  if (!attachment) return;
  try {
    const url = await saveSupportAttachment(ticketId, messageId, attachment);
    await prisma.supportMessage.update({ where: { id: messageId }, data: { attachmentUrl: url } });
  } catch (error) {
    // An attachment failure should never take the ticket/message itself down with it.
    console.error("support attachment save failed", error);
  }
}

async function sendTicketEmail(to: string, subject: string, text: string) {
  if (!isMailConfigured()) return;
  try { await sendMail({ to, subject, html: `<p>${text.replace(/\n/g, "<br/>")}</p>`, text }); }
  catch (error) { console.error("support ticket email failed", error); }
}

export async function createSupportTicket(opts: {
  actorType: ActorType; actorId: string; actorEmail: string;
  category: string; subject: string; message: string;
  relatedResourceType?: string | null; relatedResourceId?: string | null;
  attachment?: ParsedAttachment | null;
}) {
  const { actorType, actorId, actorEmail, category, subject, message, attachment } = opts;
  if (!isValidCategory(actorType, category)) throw new ApiError(400, "Choose a valid category.");
  let relatedResourceType: string | null = null;
  let relatedResourceId: string | null = null;
  if (opts.relatedResourceId) {
    relatedResourceType = opts.relatedResourceType || null;
    if (!relatedResourceType) throw new ApiError(400, "A resource type is required with a resource id.");
    const resolved = await verifyResourceOwnership(actorType, actorId, relatedResourceType, opts.relatedResourceId);
    if (!resolved) throw new ApiError(400, "That resource could not be verified against your account.");
    relatedResourceId = resolved.id;
  }
  const { ticket, msg } = await prisma.$transaction(async tx => {
    const ticket = await tx.supportTicket.create({
      data: {
        actorType,
        customerId: actorType === "CUSTOMER" ? actorId : null,
        vendorId: actorType === "VENDOR" ? actorId : null,
        category, subject: sanitizePlainText(subject, 200), relatedResourceType, relatedResourceId,
      },
    });
    const msg = await tx.supportMessage.create({ data: { ticketId: ticket.id, senderType: actorType, senderId: actorId, body: sanitizePlainText(message, 5000) } });
    return { ticket, msg };
  });
  await attachIfPresent(ticket.id, msg.id, attachment);
  await sendTicketEmail(actorEmail, `We received your ticket ${formatTicketNumber(ticket.sequence)}`, `Thanks for reaching out. Your ticket "${ticket.subject}" (${formatTicketNumber(ticket.sequence)}) has been created and our team will respond soon.`);
  return ticket;
}

export async function postOwnerMessage(opts: { actorType: ActorType; actorId: string; ticketId: string; body: string; attachment?: ParsedAttachment | null }) {
  const { actorType, actorId, ticketId, body, attachment } = opts;
  const { msg } = await prisma.$transaction(async tx => {
    const ticket = await tx.supportTicket.findFirst({ where: { id: ticketId, ...(actorType === "CUSTOMER" ? { customerId: actorId } : { vendorId: actorId }) } });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    if (ticket.status === "CLOSED") throw new ApiError(409, "This ticket is closed. Reopen it to send a new message.");
    const hasSupportReplied = (await tx.supportMessage.count({ where: { ticketId, senderType: "ADMIN", isInternalNote: false } })) > 0;
    const msg = await tx.supportMessage.create({ data: { ticketId, senderType: actorType, senderId: actorId, body: sanitizePlainText(body, 5000) } });
    await tx.supportTicket.update({ where: { id: ticketId }, data: { status: nextStatusOnOwnerMessage(ticket.status as TicketStatus, hasSupportReplied), lastActivityAt: new Date() } });
    return { ticket, msg };
  });
  await attachIfPresent(ticketId, msg.id, attachment);
  return msg;
}

export async function reopenTicket(actorType: ActorType, actorId: string, ticketId: string) {
  return prisma.$transaction(async tx => {
    const ticket = await tx.supportTicket.findFirst({ where: { id: ticketId, ...(actorType === "CUSTOMER" ? { customerId: actorId } : { vendorId: actorId }) } });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    if (ticket.status !== "CLOSED") throw new ApiError(409, "Only a closed ticket can be reopened.");
    return tx.supportTicket.update({ where: { id: ticketId }, data: { status: "OPEN", closedAt: null, lastActivityAt: new Date() } });
  });
}

export async function postAdminMessage(opts: { ticketId: string; adminId: string; body: string; isInternalNote: boolean; attachment?: ParsedAttachment | null }) {
  const { ticketId, adminId, body, isInternalNote, attachment } = opts;
  const msg = await prisma.$transaction(async tx => {
    const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    const msg = await tx.supportMessage.create({ data: { ticketId, senderType: "ADMIN", senderId: adminId, body: sanitizePlainText(body, 5000), isInternalNote } });
    await tx.supportTicket.update({ where: { id: ticketId }, data: { lastActivityAt: new Date() } });
    if (!isInternalNote) {
      const key = `support-reply:${msg.id}`;
      const href = ticketHref(ticket.actorType as ActorType, ticketId);
      const title = "Support replied to your ticket";
      const detail = `New reply on ${formatTicketNumber(ticket.sequence)}: ${ticket.subject}`;
      if (ticket.actorType === "CUSTOMER" && ticket.customerId) await notifyCustomer(tx, ticket.customerId, key, title, href, detail);
      else if (ticket.vendorId) await notifyVendor(tx, ticket.vendorId, key, title, href, detail);
    }
    return msg;
  });
  await attachIfPresent(ticketId, msg.id, attachment);
  return msg;
}

const STATUS_NOTIFY_TITLES: Partial<Record<TicketStatus, string>> = {
  WAITING_FOR_CUSTOMER: "We're waiting for your response",
  RESOLVED: "Your ticket was resolved",
  CLOSED: "Your ticket was closed",
};

export async function updateTicketAdmin(opts: { ticketId: string; status?: TicketStatus; priority?: TicketPriority; assignedToId?: string | null }) {
  const { ticketId, status, priority, assignedToId } = opts;
  return prisma.$transaction(async tx => {
    const existing = await tx.supportTicket.findUnique({ where: { id: ticketId } });
    if (!existing) throw new ApiError(404, "Ticket not found.");
    const data: Prisma.SupportTicketUpdateInput = {};
    if (status) data.status = status;
    if (priority) data.priority = priority;
    if (assignedToId !== undefined) data.assignedTo = assignedToId ? { connect: { id: assignedToId } } : { disconnect: true };
    if (status === "RESOLVED" && existing.status !== "RESOLVED") data.resolvedAt = new Date();
    if (status === "CLOSED" && existing.status !== "CLOSED") data.closedAt = new Date();
    if (status && status !== "CLOSED" && existing.status === "CLOSED") data.closedAt = null;
    const updated = await tx.supportTicket.update({ where: { id: ticketId }, data });
    if (status && status !== existing.status && STATUS_NOTIFY_TITLES[status]) {
      const key = `support-status:${ticketId}:${status}:${existing.updatedAt.getTime()}`;
      const href = ticketHref(existing.actorType as ActorType, ticketId);
      const title = STATUS_NOTIFY_TITLES[status]!;
      if (existing.actorType === "CUSTOMER" && existing.customerId) await notifyCustomer(tx, existing.customerId, key, title, href, `${title}: ${formatTicketNumber(existing.sequence)} — ${existing.subject}`);
      else if (existing.vendorId) await notifyVendor(tx, existing.vendorId, key, title, href, `${title}: ${formatTicketNumber(existing.sequence)} — ${existing.subject}`);
    }
    return updated;
  });
}
