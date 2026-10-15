export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { api } from "@/lib/marketplace-api";
import { requireAdminPermission } from "@/lib/admin-rbac";

export async function GET(request: Request) {
  const auth = await requireAdminPermission("marketing.manage");
  if ("response" in auth) return auth.response;
  return api(async () => {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || "").trim().slice(0, 100);
    const type = url.searchParams.get("type") === "vendors" ? "vendors" : "customers";
    if (query.length < 2) return { recipients: [] };
    if (type === "vendors") {
      const rows = await prisma.vendor.findMany({ where: { OR: [{ ownerName: { contains: query } }, { email: { contains: query } }, { shopName: { contains: query } }] }, select: { id: true, ownerName: true, email: true, status: true, isEmailVerified: true, marketingEmailConsentAt: true, marketingEmailUnsubscribedAt: true }, take: 30 });
      return { recipients: rows.map(row => ({ id: row.id, name: row.ownerName, email: row.email, type, eligible: row.status === "approved" && row.isEmailVerified && Boolean(row.marketingEmailConsentAt) && !row.marketingEmailUnsubscribedAt })) };
    }
    const rows = await prisma.customer.findMany({ where: { OR: [{ name: { contains: query } }, { email: { contains: query } }] }, select: { id: true, name: true, email: true, isActive: true, marketingEmailConsentAt: true, marketingEmailUnsubscribedAt: true }, take: 30 });
    return { recipients: rows.map(row => ({ id: row.id, name: row.name, email: row.email, type, eligible: row.isActive && Boolean(row.marketingEmailConsentAt) && !row.marketingEmailUnsubscribedAt })) };
  });
}
