export const dynamic = "force-dynamic";

import { z } from "zod";
import { api, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { schedulePickup } from "@/lib/pickup-workflow";

const createSchema = z.object({ requestIds: z.array(z.string().min(1)).min(1).max(50), scheduledAt: z.string().datetime(), courierName: z.string().trim().min(1).max(200).optional(), agentName: z.string().trim().min(1).max(200).optional() }).refine(v => new Set(v.requestIds).size === v.requestIds.length);

export async function GET() { return api(async () => {
  const auth = await requireAdminPermission("orders.view"); if ("response" in auth) return auth.response;
  const [requests, visits, shipped, grouped, delayed] = await Promise.all([
    prisma.pickupRequest.findMany({ where: { status: { not: "handed_over" } }, include: { vendor: { select: { shopName: true } }, shopOrder: { select: { shopOrderNumber: true, status: true } } }, orderBy: { readyAt: "asc" }, take: 250 }),
    prisma.pickupVisit.findMany({ include: { requests: { include: { shopOrder: { select: { shopOrderNumber: true, status: true } } } }, vendor: { select: { shopName: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.pickupRequest.count({ where: { status: "handed_over", shopOrder: { status: "shipped" } } }),
    prisma.pickupRequest.groupBy({ by: ["status"], _count: { _all: true }, where: { status: { notIn: ["handed_over", "cancelled"] } } }),
    prisma.pickupVisit.count({ where: { scheduledAt: { lt: new Date() }, status: { in: ["scheduled", "assigned"] } } }),
  ]);
  const counts = Object.fromEntries(grouped.map(row => [row.status, row._count._all]));
  return { requests, visits, counts: { ready: counts.ready || 0, scheduled: counts.scheduled || 0, assigned: counts.assigned || 0, collected: counts.collected || 0, failed: counts.failed || 0, delayed, shipped } };
}); }

export async function POST(req: Request) { return api(async () => {
  sameOrigin(req);
  const auth = await requireAdminPermission("orders.manage"); if ("response" in auth) return auth.response;
  const body = createSchema.parse(await req.json());
  const scheduledAt = new Date(body.scheduledAt);
  if (scheduledAt.getTime() <= Date.now()) return Response.json({ error: "Choose a future pickup time." }, { status: 400 });
  const visit = await schedulePickup({ ...body, scheduledAt, adminId: auth.admin.id });
  return { visit };
}); }
