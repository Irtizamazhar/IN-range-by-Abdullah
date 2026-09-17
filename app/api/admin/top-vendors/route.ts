import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { sanitizePlainText } from "@/lib/security/sanitize";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminPermission("homepage.manage");
  if ("response" in auth) return auth.response;
  return api(async () => {
    const rows = await prisma.topVendor.findMany({ include: { vendor: { select: { shopName: true, storeSlug: true, status: true } } }, orderBy: [{ priority: "desc" }, { createdAt: "desc" }] });
    const takenIds = rows.map(r => r.vendorId);
    const vendors = await prisma.vendor.findMany({ where: { status: "approved", id: { notIn: takenIds } }, select: { id: true, shopName: true, ownerName: true, storeSlug: true, status: true }, orderBy: { shopName: "asc" }, take: 500 });
    return { topVendors: rows, vendors };
  });
}

const addInput = z.object({ vendorId: z.string().min(1), priority: z.number().int().min(0).max(1000).default(0), label: z.string().trim().max(60).optional().default(""), reason: z.string().trim().min(3).max(2000) });

export async function POST(request: Request) {
  const auth = await requireAdminPermission("homepage.manage");
  if ("response" in auth) return auth.response;
  const admin = auth.admin;
  return api(async () => {
    sameOrigin(request); const { vendorId, priority, label, reason } = addInput.parse(await request.json());
    try {
      return await prisma.$transaction(async tx => {
        if (!await tx.vendor.findFirst({ where: { id: vendorId, status: "approved" }, select: { id: true } })) throw new ApiError(400, "Choose an approved public vendor.");
        const row = await tx.topVendor.create({ data: { vendorId, priority, label: label ? sanitizePlainText(label, 60) : null, createdBy: (admin.email || "admin") } });
        await tx.marketplaceAudit.create({ data: { actor: (admin.email || "admin"), target: row.id, action: "TOP_VENDOR_ADDED", reason } });
        await writeAdminAudit(tx, { adminId: admin.id, action: "TOP_VENDOR_ADDED", entityType: "TopVendor", entityId: row.id, details: { vendorId, reason } });
        return { topVendor: row };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "This vendor is already in Top Vendors.");
      throw error;
    }
  });
}

const updateInput = z.object({ id: z.string(), priority: z.number().int().min(0).max(1000).optional(), enabled: z.boolean().optional(), label: z.string().trim().max(60).optional(), reason: z.string().trim().min(3).max(2000) });

export async function PATCH(request: Request) {
  const auth = await requireAdminPermission("homepage.manage");
  if ("response" in auth) return auth.response;
  const admin = auth.admin;
  return api(async () => {
    sameOrigin(request); const { id, reason, ...rest } = updateInput.parse(await request.json());
    const data: Prisma.TopVendorUpdateInput = {};
    if (rest.priority !== undefined) data.priority = rest.priority;
    if (rest.enabled !== undefined) data.enabled = rest.enabled;
    if (rest.label !== undefined) data.label = rest.label ? sanitizePlainText(rest.label, 60) : null;
    return prisma.$transaction(async tx => {
      const existing = await tx.topVendor.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new ApiError(404, "Top Vendor entry not found.");
      const row = await tx.topVendor.update({ where: { id }, data });
      await tx.marketplaceAudit.create({ data: { actor: (admin.email || "admin"), target: id, action: "TOP_VENDOR_UPDATED", reason } });
      await writeAdminAudit(tx, { adminId: admin.id, action: "TOP_VENDOR_UPDATED", entityType: "TopVendor", entityId: id, details: { ...rest, reason } });
      return { topVendor: row };
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
    if (!id) throw new ApiError(400, "Missing Top Vendor id.");
    if (reason.trim().length < 3) throw new ApiError(400, "An audit reason is required.");
    return prisma.$transaction(async tx => {
      const existing = await tx.topVendor.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new ApiError(404, "Top Vendor entry not found.");
      await tx.topVendor.delete({ where: { id } });
      await tx.marketplaceAudit.create({ data: { actor: (admin.email || "admin"), target: id, action: "TOP_VENDOR_REMOVED", reason } });
      await writeAdminAudit(tx, { adminId: admin.id, action: "TOP_VENDOR_REMOVED", entityType: "TopVendor", entityId: id, details: { reason } });
      return { ok: true };
    });
  });
}
