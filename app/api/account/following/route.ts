import { prisma } from "@/lib/prisma";
import { api, customerActor } from "@/lib/marketplace-api";
import { publicStoreSelect } from "@/lib/store-service";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => {
  const customer = await customerActor();
  const follows = await prisma.storeFollow.findMany({ where: { customerId: customer.id, vendor: { status: "approved" } }, select: { vendor: { select: publicStoreSelect } }, orderBy: { createdAt: "desc" }, take: 100 });
  return { stores: follows.map(f => f.vendor) };
}); }