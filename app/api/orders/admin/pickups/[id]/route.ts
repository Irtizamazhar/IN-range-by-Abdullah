export const dynamic = "force-dynamic";

import { z } from "zod";
import { api, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { updatePickupVisit } from "@/lib/pickup-workflow";
import { runAfterVendorShopOrderStatusChange } from "@/lib/after-vendor-shop-order-status";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ action: z.enum(["assign", "reschedule", "fail", "collect", "handover"]), scheduledAt: z.string().datetime().optional(), courierName: z.string().trim().min(1).max(200).optional(), agentName: z.string().trim().min(1).max(200).optional(), reason: z.string().trim().min(3).max(2000).optional(), exceptionEvidence: z.string().trim().min(10).max(2000).optional(), handoverReference: z.string().trim().min(1).max(191).optional(), trackingNumbers: z.record(z.string(), z.string().trim().min(1).max(255)).optional() });

export async function GET(_req: Request, ctx: Ctx) { return api(async () => {
  const auth = await requireAdminPermission("orders.view"); if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  const visit = await prisma.pickupVisit.findUnique({ where: { id }, include: { vendor: { select: { shopName: true } }, requests: { include: { shopOrder: { select: { id: true, shopOrderNumber: true, status: true } } } } } });
  return visit ? { visit } : Response.json({ error: "Not found" }, { status: 404 });
}); }

export async function PATCH(req: Request, ctx: Ctx) { return api(async () => {
  sameOrigin(req);
  const auth = await requireAdminPermission("orders.manage"); if ("response" in auth) return auth.response;
  const body = schema.parse(await req.json());
  if ((body.action === "reschedule" && !body.scheduledAt) || (body.action === "assign" && !body.courierName && !body.agentName) || (body.action === "fail" && !body.reason) || (body.action === "handover" && (!body.handoverReference || !body.trackingNumbers))) return Response.json({ error: "Required pickup details are missing." }, { status: 400 });
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : undefined;
  if (scheduledAt && scheduledAt.getTime() <= Date.now()) return Response.json({ error: "Choose a future pickup time." }, { status: 400 });
  const { id } = await ctx.params;
  const result = await updatePickupVisit({ ...body, visitId: id, adminId: auth.admin.id, scheduledAt });
  if (result.shippedOrderIds.length) {
    const notifications = await Promise.allSettled(result.shippedOrderIds.map(shopOrderId => runAfterVendorShopOrderStatusChange({ shopOrderId, newStatus: "shipped" })));
    for (const notification of notifications) if (notification.status === "rejected") console.error("Pickup handover notification failed", notification.reason);
  }
  return { ok: true, ...result };
}); }
