import { prisma } from "@/lib/prisma";
import { api, customerActor } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => {
  const customer = await customerActor();
  return { offers: await prisma.wantOffer.findMany({ where: { want: { customerId: customer.id } }, include: { vendor: { select: { id: true, shopName: true, status: true, storeSlug: true } }, want: { select: { id: true, title: true, status: true, city: true } }, revisions: { orderBy: { revisionNumber: "desc" } } }, orderBy: { updatedAt: "desc" }, take: 100 }) };
}); }