import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { promotionInput } from "@/lib/promotion-service";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminPermission("homepage.manage");
  if ("response" in auth) return auth.response;
  return api(async () => ({
    campaigns: await prisma.vendorPromotion.findMany({ include: { vendor: { select: { shopName: true, storeSlug: true, status: true } } }, orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 200 }),
    vendors: await prisma.vendor.findMany({ where: { status: "approved" }, select: { id: true, shopName: true, ownerName: true, storeSlug: true, status: true }, orderBy: { shopName: "asc" }, take: 500 }),
  }));
}

async function save(request: Request) {
  const auth = await requireAdminPermission("homepage.manage");
  if ("response" in auth) return auth.response;
  const admin = auth.admin;
  return api(async () => {
    sameOrigin(request); const { id, reason, ...input } = promotionInput.parse(await request.json());
    return prisma.$transaction(async tx => {
      if (!await tx.vendor.findFirst({ where: { id: input.vendorId, status: "approved" }, select: { id: true } })) throw new ApiError(400, "Choose an approved public vendor.");
      const data = { ...input, startAt: new Date(input.startAt), endAt: input.endAt ? new Date(input.endAt) : null };
      const campaign = id ? await tx.vendorPromotion.update({ where: { id }, data }) : await tx.vendorPromotion.create({ data: { ...data, createdBy: (admin.email || "admin") } });
      await tx.marketplaceAudit.create({ data: { actor: (admin.email || "admin"), target: campaign.id, action: id ? "PROMOTION_UPDATED" : "PROMOTION_CREATED", reason } });
      await writeAdminAudit(tx, { adminId: admin.id, action: id ? "PROMOTION_UPDATED" : "PROMOTION_CREATED", entityType: "VendorPromotion", entityId: campaign.id, details: { reason } });
      return { campaign };
    });
  });
}
export const POST = save;
export const PATCH = save;

const statusAction = z.object({ id: z.string(), status: z.enum(["DRAFT", "ACTIVE", "DISABLED", "ARCHIVED"]), reason: z.string().trim().min(3).max(2000) });
/** Quick enable/disable/archive without resubmitting the full form. */
export async function PUT(request: Request) {
  const auth = await requireAdminPermission("homepage.manage");
  if ("response" in auth) return auth.response;
  const admin = auth.admin;
  return api(async () => {
    sameOrigin(request); const { id, status, reason } = statusAction.parse(await request.json());
    return prisma.$transaction(async tx => {
      const existing = await tx.vendorPromotion.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new ApiError(404, "Promotion not found.");
      const campaign = await tx.vendorPromotion.update({ where: { id }, data: { status } });
      await tx.marketplaceAudit.create({ data: { actor: (admin.email || "admin"), target: id, action: `PROMOTION_STATUS_${status}`, reason } });
      await writeAdminAudit(tx, { adminId: admin.id, action: `PROMOTION_STATUS_${status}`, entityType: "VendorPromotion", entityId: id, details: { reason } });
      return { campaign };
    });
  });
}

export async function DELETE(request: Request) {
  const auth = await requireAdminPermission("homepage.manage");
  if ("response" in auth) return auth.response;
  const admin = auth.admin;
  return api(async () => {
    sameOrigin(request);
    const { searchParams } = new URL(request.url); const id = searchParams.get("id") || "";
    const reason = searchParams.get("reason") || "";
    if (!id) throw new ApiError(400, "Missing promotion id.");
    if (reason.trim().length < 3) throw new ApiError(400, "An audit reason is required.");
    return prisma.$transaction(async tx => {
      const existing = await tx.vendorPromotion.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new ApiError(404, "Promotion not found.");
      await tx.vendorPromotion.delete({ where: { id } });
      await tx.marketplaceAudit.create({ data: { actor: (admin.email || "admin"), target: id, action: "PROMOTION_DELETED", reason } });
      await writeAdminAudit(tx, { adminId: admin.id, action: "PROMOTION_DELETED", entityType: "VendorPromotion", entityId: id, details: { reason } });
      return { ok: true };
    });
  });
}
