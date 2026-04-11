import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** `VendorShopOrder` delegate — typed loosely so old generated clients still compile. */
type VendorShopOrderDelegate = {
  findFirst(args: {
    where: { shopOrderNumber: string };
    select: { orderId: true };
  }): Promise<{ orderId: string } | null>;
};

export function getVendorShopOrderDelegate(): VendorShopOrderDelegate {
  return (prisma as unknown as { vendorShopOrder: VendorShopOrderDelegate })
    .vendorShopOrder;
}

/** For tests or alternate PrismaClient instances. */
export function vendorShopOrderFrom(client: PrismaClient): VendorShopOrderDelegate {
  return (client as unknown as { vendorShopOrder: VendorShopOrderDelegate })
    .vendorShopOrder;
}
