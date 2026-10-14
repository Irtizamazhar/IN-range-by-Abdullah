import { api, customerActor } from "@/lib/marketplace-api";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => {
  const customer = await customerActor();
  // Rejected Wants and Wants from deactivated owners drop out of the list.
  const rows = await prisma.wantInterest.findMany({ where: { customerId: customer.id, want: { status: { in: ["OPEN", "FULFILLED"] }, customer: { isActive: true } } }, orderBy: { createdAt: "desc" }, take: 100, select: { want: { select: { id: true, title: true, requestType: true, category: true, city: true, status: true, expiresAt: true, _count: { select: { interests: true, offers: true } } } } } });
  return { wants: rows.map(row => row.want) };
}); }
