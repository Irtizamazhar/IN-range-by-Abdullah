import { NextRequest } from "next/server";
import { z } from "zod";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

const inputSchema = z.object({ id: z.string().optional(), name: z.string().trim().min(2).max(160), productIds: z.array(z.string().min(1)).min(1).max(100) });

async function save(request: NextRequest) {
  const auth = await requireAdminPermission("coupons.manage"); if ("response" in auth) return auth.response;
  return api(async () => {
    sameOrigin(request);
    const input = inputSchema.parse(await request.json());
    if (await prisma.product.count({ where: { id: { in: input.productIds }, isActive: true } }) !== new Set(input.productIds).size) throw new ApiError(400, "Select active products only.");
    const collection = input.id
      ? await prisma.couponCollection.update({ where: { id: input.id }, data: { name: input.name, productIds: input.productIds } })
      : await prisma.couponCollection.create({ data: { name: input.name, productIds: input.productIds, createdBy: auth.admin.email || "admin" } });
    await writeAdminAudit(prisma, { adminId: auth.admin.id, action: input.id ? "COUPON_COLLECTION_UPDATED" : "COUPON_COLLECTION_CREATED", entityType: "CouponCollection", entityId: collection.id, details: { name: collection.name } });
    return { collection };
  });
}
export const POST = save;
export const PATCH = save;
