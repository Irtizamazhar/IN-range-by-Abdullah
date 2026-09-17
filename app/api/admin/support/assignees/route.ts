import { prisma } from "@/lib/prisma";
import { api } from "@/lib/marketplace-api";
import { requireAdminPermission } from "@/lib/admin-rbac";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminPermission("support.manage");
  if ("response" in auth) return auth.response;
  return api(async () => ({
    assignees: await prisma.adminUser.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 100 }),
  }));
}
