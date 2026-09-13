export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { createCustomerNotification } from "@/lib/customer-notifications";

export async function GET() {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;
  const wants = await prisma.want.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { customer: { select: { name: true, email: true } }, _count: { select: { offers: true, interests: true } } },
  });
  return NextResponse.json({ wants });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;
  try {
    sameOrigin(request);
    const input = z.object({ id: z.string(), status: z.enum(["OPEN", "REJECTED", "CLOSED"]), reason: z.string().trim().min(3).max(2000) }).parse(await request.json());
    const want = await prisma.$transaction(async (tx) => {
      const current = await tx.want.findUnique({ where: { id: input.id } });
      if (!current) throw new ApiError(404, "Want not found.");
      if (input.status === "OPEN" && (current.expiresAt <= new Date() || !["PENDING_MODERATION", "SUBMITTED", "REJECTED"].includes(current.status))) {
        throw new ApiError(409, "This Want cannot be opened.");
      }
      await tx.marketplaceAudit.create({ data: { actor: auth.admin.email || "admin", action: `WANT_${input.status}`, target: input.id, reason: input.reason } });
      await writeAdminAudit(tx, { adminId: auth.admin.id, action: "want_moderated", entityType: "Want", entityId: input.id, details: { fromStatus: current.status, toStatus: input.status, reason: input.reason } });
      const updated = await tx.want.update({ where: { id: input.id }, data: { status: input.status, moderationReason: input.reason } });
      await createCustomerNotification({
        customerId: updated.customerId,
        type: "want_moderation",
        title: input.status === "OPEN" ? "Your Want is now live" : `Your Want was ${input.status.toLowerCase()}`,
        message: input.reason,
        link: `/wants/${updated.id}`,
        idempotencyKey: `want-moderation:${updated.id}:${input.status}`,
      }, tx);
      return updated;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ want });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Please check the supplied fields." }, { status: 400 });
    console.error("Admin want moderation failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "This feature is temporarily unavailable. Please try again later." }, { status: 503 });
  }
}
