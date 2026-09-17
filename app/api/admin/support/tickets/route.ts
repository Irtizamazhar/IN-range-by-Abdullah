import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { api } from "@/lib/marketplace-api";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { TICKET_PRIORITIES, TICKET_STATUSES, clampPage, formatTicketNumber, isValidPriority, isValidStatus } from "@/lib/support-service";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminPermission("support.manage");
  if ("response" in auth) return auth.response;
  return api(async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const actorType = searchParams.get("actorType") || "";
    const category = searchParams.get("category") || "";
    const priority = searchParams.get("priority") || "";
    const q = (searchParams.get("q") || "").trim();
    const { page, pageSize, skip, take } = clampPage(searchParams.get("page"), searchParams.get("pageSize"));

    const where: Prisma.SupportTicketWhereInput = {};
    if (isValidStatus(status)) where.status = status;
    if (actorType === "CUSTOMER" || actorType === "VENDOR") where.actorType = actorType;
    if (category) where.category = category;
    if (isValidPriority(priority)) where.priority = priority;
    if (q) {
      const sequenceMatch = /^(?:JORO-)?(\d{5,})$/i.exec(q);
      where.OR = [
        { subject: { contains: q } },
        { relatedResourceId: { contains: q } },
        ...(sequenceMatch ? [{ sequence: Number(sequenceMatch[1]) - 10000 }] : []),
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        select: {
          id: true, sequence: true, actorType: true, category: true, subject: true, status: true, priority: true,
          relatedResourceType: true, relatedResourceId: true, createdAt: true, lastActivityAt: true,
          customer: { select: { name: true, email: true } },
          vendor: { select: { shopName: true, email: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: [{ lastActivityAt: "desc" }],
        skip, take,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return {
      tickets: rows.map(t => ({ ...t, ticketNumber: formatTicketNumber(t.sequence) })),
      page, pageSize, total,
      statuses: TICKET_STATUSES, priorities: TICKET_PRIORITIES,
    };
  });
}
