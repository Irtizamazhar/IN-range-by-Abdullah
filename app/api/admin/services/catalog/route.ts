import { assertServiceImageStored } from "@/lib/service-images";
import { prisma } from "@/lib/prisma";
import { api, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission, writeAdminAudit } from "@/lib/admin-rbac";
import { catalogInput } from "@/lib/service-management";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await requireAdminPermission("moderation.manage"); if ("response" in auth) return auth.response;
  return api(async () => {
    sameOrigin(request); const { id, ...data } = catalogInput.parse(await request.json());
    return prisma.$transaction(async tx => {
      const previous = id && data.imageUrl !== undefined ? await tx.serviceCatalog.findUnique({ where: { id }, select: { imageUrl: true } }) : null;
      if (data.imageUrl !== undefined && data.imageUrl !== previous?.imageUrl) await assertServiceImageStored(data.imageUrl, "catalog");
      const catalog = id ? await tx.serviceCatalog.update({ where: { id }, data }) : await tx.serviceCatalog.create({ data });
      await writeAdminAudit(tx, { adminId: auth.admin.id, action: id ? "service_catalog_updated" : "service_catalog_created", entityType: "ServiceCatalog", entityId: catalog.id, details: { ...data } });
      return { catalog };
    });
  });
}
