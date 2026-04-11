import type { Prisma } from "@prisma/client";
import type { MarketplacePrisma } from "@/lib/marketplace-prisma";

/**
 * Commission % for a line: vendor override, else category row, else "Other"/10.
 */
export async function resolveCommissionPercent(
  tx: Pick<MarketplacePrisma, "commissionSetting">,
  productCategory: string,
  vendorSpecialRate: Prisma.Decimal | null | undefined
): Promise<number> {
  if (vendorSpecialRate != null) {
    const n = Number(vendorSpecialRate);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return Math.round(n * 100) / 100;
  }
  const cat = productCategory.trim();
  const row =
    cat.length > 0
      ? await tx.commissionSetting.findUnique({
          where: { categoryName: cat },
        })
      : null;
  if (row) return Number(row.commissionPercentage);
  const other = await tx.commissionSetting.findUnique({
    where: { categoryName: "Other" },
  });
  if (other) return Number(other.commissionPercentage);
  const globalRow = await tx.commissionSetting.findUnique({
    where: { categoryName: "Global" },
  });
  return globalRow ? Number(globalRow.commissionPercentage) : 10;
}
