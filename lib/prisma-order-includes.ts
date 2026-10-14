import type { Order, OrderItem, Prisma } from "@prisma/client";

/**
 * Shared Order query fragments. Cast to Prisma input types so a slightly stale
 * `node_modules/.prisma` (before `npm run db:generate`) does not break the build.
 */
export const ORDER_INCLUDE_SERIALIZE = {
  orderItems: true,
  vendorShopOrders: { select: { status: true, shopOrderNumber: true } },
  couponRedemption: { select: { discount: true, platformFunded: true, snapshot: true, status: true } },
} as unknown as Prisma.OrderInclude;

export type OrderWithSerializeRelations = Order & {
  orderItems: OrderItem[];
  vendorShopOrders: { status: string; shopOrderNumber: string }[];
  couponRedemption?: { discount: Prisma.Decimal; platformFunded: Prisma.Decimal; snapshot: Prisma.JsonValue; status: string } | null;
};

export const ORDER_INCLUDE_REVIEW = {
  orderItems: {
    include: {
      inventoryLine: {
        select: {
          vendorShopOrder: { select: { status: true } },
        },
      },
    },
  },
  vendorShopOrders: { select: { status: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithReviewRelations = Prisma.OrderGetPayload<{
  include: typeof ORDER_INCLUDE_REVIEW;
}>;

export const WHERE_PARENT_ORDER_ONLY = {
  vendorShopOrders: { none: {} },
} as Prisma.OrderWhereInput;
