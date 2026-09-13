import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, { params }: { params: { id: string } }) { return api(async () => {
  sameOrigin(request); const c = await customerActor(); const result = await prisma.customerNotification.updateMany({ where: { id: params.id, customerId: c.id }, data: { isRead: true } });
  if (!result.count) throw new ApiError(404, "Notification not found."); return { ok: true };
}); }