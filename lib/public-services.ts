import { prisma } from "@/lib/prisma";

export const publicServiceSelect = {
  id: true, name: true, description: true, type: true, price: true,
  cities: true, durationMinutes: true, leadDays: true, warranty: true,
  cancellationTerms: true,
  vendor: { select: { id: true, shopName: true, storeSlug: true, city: true, shopLogo: true } },
} as const;

export async function publicServices(filters: { search?: string; category?: string; city?: string; take?: number } = {}) {
  const { search = "", category = "", city = "", take = 48 } = filters;
  const rows = await prisma.serviceOffering.findMany({
    where: {
      active: true, moderationStatus: "APPROVED", vendor: { status: "approved" },
      ...(search ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] } : {}),
      ...(category ? { type: category } : {}),
      ...(city ? { cities: { array_contains: city } } : {}),
    },
    select: publicServiceSelect,
    orderBy: { createdAt: "desc" }, take: Math.min(100, Math.max(1, take)),
  });
  return rows;
}

export function serviceCities(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((city): city is string => typeof city === "string") : [];
}
