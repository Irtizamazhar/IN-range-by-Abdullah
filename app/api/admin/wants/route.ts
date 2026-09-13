import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, adminActor, sameOrigin } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => { await adminActor(); return { wants: await prisma.want.findMany({ orderBy: { createdAt: "desc" }, take: 100 }) }; }); }
export async function PATCH(request: Request) { return api(async () => {
  sameOrigin(request); const actor = await adminActor(); const input = z.object({ id: z.string(), status: z.enum(["OPEN", "REJECTED", "CLOSED"]), reason: z.string().trim().min(3).max(2000) }).parse(await request.json());
  return prisma.$transaction(async tx => {
    const want = await tx.want.findUnique({ where: { id: input.id } }); if (!want) throw new ApiError(404, "Want not found.");
    if (input.status === "OPEN" && (want.expiresAt <= new Date() || !["PENDING_MODERATION", "SUBMITTED", "REJECTED"].includes(want.status))) throw new ApiError(409, "This Want cannot be opened.");
    await tx.marketplaceAudit.create({ data: { actor, action: `WANT_${input.status}`, target: input.id, reason: input.reason } });
    return { want: await tx.want.update({ where: { id: input.id }, data: { status: input.status, moderationReason: input.reason } }) };
  }, { isolationLevel: "Serializable" });
}); }