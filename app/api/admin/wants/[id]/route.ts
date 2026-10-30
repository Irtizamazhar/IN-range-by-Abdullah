export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { deleteWants, removeWantPhotos } from "@/lib/admin-want-delete";

type Context = { params: { id: string } };
const account = {
  customer: { select: { id: true, name: true, email: true, isActive: true } },
  vendor: { select: { id: true, shopName: true, email: true, status: true } },
} as const;

/** Reports and reactions for one Want, so moderators can review abuse. */
export async function GET(_request: Request, { params }: Context) {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;
  const want = await prisma.want.findUnique({ where: { id: params.id }, select: { id: true, title: true, status: true } });
  if (!want) return NextResponse.json({ error: "Want not found." }, { status: 404 });
  const [reports, reactions] = await Promise.all([
    prisma.wantReport.findMany({ where: { wantId: want.id }, orderBy: { createdAt: "desc" }, take: 200, include: account }),
    prisma.wantReaction.findMany({ where: { wantId: want.id }, orderBy: { updatedAt: "desc" }, take: 500, include: account }),
  ]);
  return NextResponse.json({ want, reports, reactions });
}

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("dismissReports"), reason: z.string().trim().min(3).max(1000) }),
  z.object({ action: z.literal("removeReaction"), reactionId: z.string().min(1).max(191), reason: z.string().trim().min(3).max(1000) }),
]);

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;
  try {
    sameOrigin(request);
    const input = action.parse(await request.json());
    const actor = auth.admin.email || "admin";
    const result = await prisma.$transaction(async (tx) => {
      const want = await tx.want.findUnique({ where: { id: params.id }, select: { id: true } });
      if (!want) throw new ApiError(404, "Want not found.");
      if (input.action === "dismissReports") {
        const { count } = await tx.wantReport.updateMany({ where: { wantId: want.id, status: "OPEN" }, data: { status: "DISMISSED", reviewedBy: actor, reviewedAt: new Date() } });
        await tx.marketplaceAudit.create({ data: { actor, action: "WANT_REPORTS_DISMISSED", target: want.id, reason: input.reason } });
        await writeAdminAudit(tx, { adminId: auth.admin.id, action: "want_reports_dismissed", entityType: "Want", entityId: want.id, details: { count, reason: input.reason } });
        return { dismissed: count };
      }
      const reaction = await tx.wantReaction.findFirst({ where: { id: input.reactionId, wantId: want.id } });
      if (!reaction) throw new ApiError(404, "Reaction not found.");
      await tx.wantReaction.delete({ where: { id: reaction.id } });
      await tx.marketplaceAudit.create({ data: { actor, action: "WANT_REACTION_REMOVED", target: want.id, reason: input.reason } });
      await writeAdminAudit(tx, { adminId: auth.admin.id, action: "want_reaction_removed", entityType: "Want", entityId: want.id, details: { reactionId: reaction.id, type: reaction.type, customerId: reaction.customerId, vendorId: reaction.vendorId, reason: input.reason } });
      return { removed: reaction.id };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Please check the supplied fields." }, { status: 400 });
    console.error("Admin want review failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "This feature is temporarily unavailable. Please try again later." }, { status: 503 });
  }
}

/** Permanently deletes one Want and its Want-module records. Wants that already became an order are kept. */
export async function DELETE(request: Request, { params }: Context) {
  const auth = await requireAdminPermission("moderation.manage");
  if ("response" in auth) return auth.response;
  try {
    sameOrigin(request);
    const result = await prisma.$transaction(async (tx) => {
      const want = await tx.want.findUnique({ where: { id: params.id }, select: { id: true, title: true, status: true, customerId: true } });
      if (!want) throw new ApiError(404, "Want not found.");
      const deleted = await deleteWants(tx, { id: want.id });
      if (!deleted.ids.length) throw new ApiError(409, "This Want already has an order, so it can't be deleted.");
      await tx.marketplaceAudit.create({ data: { actor: auth.admin.email || "admin", action: "WANT_DELETED", target: want.id, reason: "Permanently deleted by admin." } });
      await writeAdminAudit(tx, { adminId: auth.admin.id, action: "want_deleted", entityType: "Want", entityId: want.id, details: { title: want.title, status: want.status, customerId: want.customerId } });
      return deleted;
    }, { isolationLevel: "Serializable" });
    await removeWantPhotos(result.photos);
    return NextResponse.json({ deleted: result.ids.length });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Admin want delete failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Could not delete this Want. Please try again later." }, { status: 503 });
  }
}
