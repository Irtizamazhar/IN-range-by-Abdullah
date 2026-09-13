import { prisma } from "@/lib/prisma";
import { api } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) { return api(async () => {
  const rows = await prisma.productServiceAddon.findMany({ where: { productId: params.id, active: true, product: { isActive: true, vendorPublication: { status: "active", vendor: { status: "approved" } } }, service: { active: true, vendor: { status: "approved" } } }, select: { service: { select: { id: true, name: true, description: true, price: true, cities: true, durationMinutes: true, leadDays: true, warranty: true, cancellationTerms: true } } } });
  return { services: rows.map(r => r.service) };
}); }