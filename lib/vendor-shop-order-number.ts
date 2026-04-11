import { prisma } from "@/lib/prisma";

/**
 * Delegate slice we need inside `prisma.$transaction` callbacks.
 * Interactive `tx` is typed as `Omit<PrismaClient, …>` and TS sometimes omits
 * newer models from that type even though they exist at runtime — callers cast `tx` to this.
 */
export type VendorShopOrderTx = {
  vendorShopOrder: Pick<typeof prisma.vendorShopOrder, "findFirst">;
};

/**
 * Sequential display numbers for vendor shop orders (bundled checkout slice).
 * Uses IRV- prefix to distinguish from storefront order numbers (IRB-).
 */
export async function generateVendorShopOrderNumber(
  tx: VendorShopOrderTx
): Promise<string> {
  const last = await tx.vendorShopOrder.findFirst({
    orderBy: { placedAt: "desc" },
    select: { shopOrderNumber: true },
  });
  let next = 1;
  if (last?.shopOrderNumber) {
    const m = last.shopOrderNumber.match(/IRV-(\d+)/i);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `IRV-${String(next).padStart(4, "0")}`;
}
