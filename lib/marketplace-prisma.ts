import { prisma } from "@/lib/prisma";

/**
 * Structural delegates for vendor + commission models. Keeps API routes type-clean when
 * the workspace `PrismaClient` typedef lags `schema.prisma` (run `npx prisma generate`).
 */
export type VendorForOrder = {
  status: string;
  specialCommissionRate: unknown;
};

export type VendorProductOrderRow = {
  id: string;
  vendorId: string;
  category: string;
  stock: number;
  status: string;
  vendor: VendorForOrder;
};

export type MarketplacePrisma = {
  commissionSetting: {
    findUnique(args: {
      where: { categoryName: string };
    }): Promise<{ commissionPercentage: unknown } | null>;
  };
  vendorProduct: {
    findFirst(args: {
      where: Record<string, unknown>;
      include?: Record<string, unknown>;
    }): Promise<VendorProductOrderRow | null>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  vendorOrder: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  vendor: {
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
};

export function getMarketplacePrisma(): MarketplacePrisma {
  return prisma as unknown as MarketplacePrisma;
}

export function getMarketplaceTx(tx: unknown): MarketplacePrisma {
  return tx as MarketplacePrisma;
}
