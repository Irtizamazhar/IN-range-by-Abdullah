import { prisma } from "@/lib/prisma";
import { api } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) { return api(async () => {
  const rows = await prisma.productServiceAddon.findMany({ where: { productId: params.id, active: true, product: { isActive: true, vendorPublication: { status: "active", vendor: { status: "approved" } } }, service: { active: true, moderationStatus: "APPROVED", vendor: { status: "approved" } } }, select: { product: { select: { vendorPublication: { select: { vendorId: true } } } }, service: { select: { id: true, vendorId: true, name: true, description: true, price: true, cities: true, durationMinutes: true, leadDays: true, warranty: true, cancellationTerms: true } } } });
  return { services: rows.filter(row => row.product.vendorPublication?.vendorId === row.service.vendorId).map(row => ({
    id: row.service.id, name: row.service.name, description: row.service.description,
    price: row.service.price, cities: row.service.cities, durationMinutes: row.service.durationMinutes,
    leadDays: row.service.leadDays, warranty: row.service.warranty,
    cancellationTerms: row.service.cancellationTerms,
  })) };
}); }
