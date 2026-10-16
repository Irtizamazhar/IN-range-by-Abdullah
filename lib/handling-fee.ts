import type { Prisma } from "@prisma/client";
import type { MarketplacePrisma } from "@/lib/marketplace-prisma";
import { resolveCommissionPercent } from "@/lib/vendor-commission";

/**
 * Customer-facing "Handling Fee": each line's base × its applicable commission %
 * (vendor override → category → "Other" → "Global"), using the same resolver as
 * vendor commission. On checkouts that charge this fee the vendor keeps the full
 * sale amount, so the commission is collected once — from the customer.
 */
export type HandlingFeeLine = {
  /** Vendor product category for vendor lines, product category otherwise. */
  category: string;
  vendorSpecialCommissionRate: Prisma.Decimal | null;
  /** Line total in cents, less any vendor-funded coupon discount (same base as commission). */
  baseCents: number;
};

export async function calculateHandlingFee(
  db: Pick<MarketplacePrisma, "commissionSetting">,
  lines: HandlingFeeLine[]
): Promise<{ totalCents: number; lines: { rate: number; feeCents: number }[] }> {
  let totalCents = 0;
  const perLine: { rate: number; feeCents: number }[] = [];
  for (const line of lines) {
    const rate = await resolveCommissionPercent(db, line.category, line.vendorSpecialCommissionRate);
    const feeCents = line.baseCents > 0 ? Math.round((line.baseCents * rate) / 100) : 0;
    totalCents += feeCents;
    perLine.push({ rate, feeCents });
  }
  return { totalCents, lines: perLine };
}
