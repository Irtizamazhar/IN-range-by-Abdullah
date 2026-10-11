import { z } from "zod";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;
  return api(async () => ({ services: await prisma.serviceOffering.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, name: true, type: true, price: true, cities: true, active: true, moderationStatus: true, moderationReason: true, createdAt: true, vendor: { select: { id: true, shopName: true, status: true } } } }) }));
}
export async function PATCH(request: Request) {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;
  return api(async () => {
    sameOrigin(request);
    const input = z.object({ id: z.string().min(1), active: z.boolean(), reason: z.string().trim().min(3).max(1000) }).parse(await request.json());
    return prisma.$transaction(async tx => {
      const current = await tx.serviceOffering.findUnique({ where: { id: input.id }, select: { id: true, active: true, moderationStatus: true } });
      if (!current) throw new ApiError(404, "Service not found.");
      const updated = await tx.serviceOffering.update({ where: { id: input.id }, data: { active: input.active, moderationStatus: input.active ? "APPROVED" : "HIDDEN", moderationReason: input.reason } });
      await writeAdminAudit(tx, { adminId: auth.admin.id, action: "service_listing_moderated", entityType: "ServiceOffering", entityId: input.id, details: { fromActive: current.active, toActive: input.active, fromModerationStatus: current.moderationStatus, reason: input.reason } });
      return { service: { id: updated.id, active: updated.active } };
    }, { isolationLevel: "Serializable" });
  });
}
