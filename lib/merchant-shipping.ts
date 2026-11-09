import { prisma } from "@/lib/prisma";

export type MerchantShipping = { fee: number; cities: string[] };

/** Same persisted settings as standard catalog checkout; never initialize settings or invent fallback prices. */
export async function readMerchantShipping(): Promise<MerchantShipping | null> {
  try {
    const row = await prisma.settings.findFirst({ select: { codCharges: true, codAvailableCities: true } });
    if (!row || row.codCharges == null) return null;
    const fee = Number(row.codCharges);
    if (!Number.isFinite(fee) || fee < 0 || !Array.isArray(row.codAvailableCities) ||
      !row.codAvailableCities.every(city => typeof city === "string" && city.trim().length > 0)) return null;
    return { fee, cities: Array.from(new Set((row.codAvailableCities as string[]).map(city => city.trim()))) };
  } catch { return null; }
}

// Do not emit ShippingService/OfferShippingDetails for city-restricted Pakistan delivery.
// Google's DefinedRegion supports neither Pakistani subdivisions nor Pakistani postal codes.
// Country-only markup would overstate checkout eligibility. Revisit after coverage is confirmed.
