import { prisma } from "@/lib/prisma";

export const publicServiceSelect = {
  id: true, name: true, description: true, type: true, price: true,
  cities: true, durationMinutes: true, leadDays: true, warranty: true,
  cancellationTerms: true, coverage: true, priceType: true, imageUrl: true,
  catalog: { select: { imageUrl: true } },
  vendor: { select: { id: true, shopName: true, storeSlug: true, city: true, shopLogo: true } },
} as const;

export async function publicServices(filters: { search?: string; category?: string; city?: string; cityId?: string; areaId?: string; take?: number } = {}) {
  const { search = "", category = "", city = "", cityId = "", areaId = "", take = 48 } = filters;
  const rows = await prisma.serviceOffering.findMany({
    where: {
      active: true, moderationStatus: "APPROVED", vendor: { status: "approved" },
      ...(search ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] } : {}),
      ...(category ? { type: category } : {}),
      ...(city ? { cities: { array_contains: city } } : {}),
      ...(cityId ? { AND: [{ coverage: { array_contains: [{ city: { id: cityId, proof: { version: 2 } } }] } }, ...(areaId ? [{ OR: [{ coverage: { array_contains: [{ city: { id: cityId, proof: { version: 2 } }, entireCity: true }] } }, { coverage: { array_contains: [{ city: { id: cityId, proof: { version: 2 } }, areas: [{ id: areaId, proof: { version: 2, citySourceId: cityId } }] }] } }] }] : [])] } : areaId ? { id: "__invalid_area_without_city__" } : {}),
    },
    select: publicServiceSelect,
    orderBy: { createdAt: "desc" }, take: Math.min(100, Math.max(1, take)),
  });
  return rows;
}

export function serviceCities(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((city): city is string => typeof city === "string") : [];
}
