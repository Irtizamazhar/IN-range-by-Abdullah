import { api, customerActor } from "@/lib/marketplace-api";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => {
  const customer = await customerActor();
  const rows = await prisma.wantInterest.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 100, select: { want: { select: { id: true, title: true, requestType: true, category: true, city: true, status: true, expiresAt: true, _count: { select: { interests: true, offers: true } } } } } });
  return { wants: rows.map(row => row.want) };
}); }
