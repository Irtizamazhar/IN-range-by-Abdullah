import type { Order, OrderItem, Prisma } from "@prisma/client";

/**
 * Shared Order query fragments. Cast to Prisma input types so a slightly stale
 * `node_modules/.prisma` (before `npm run db:generate`) does not break the build.
 */
export const ORDER_INCLUDE_SERIALIZE = {
  orderItems: true,
  vendorShopOrders: { select: { status: true, shopOrderNumber: true } },
} as unknown as Prisma.OrderInclude;

export type OrderWithSerializeRelations = Order & {
  orderItems: OrderItem[];
  vendorShopOrders: { status: string; shopOrderNumber: string }[];
};

export const ORDER_INCLUDE_REVIEW = {
  orderItems: true,
  vendorShopOrders: { select: { status: true } },
} as unknown as Prisma.OrderInclude;

export type OrderWithReviewRelations = Order & {
  orderItems: OrderItem[];
  vendorShopOrders: { status: string }[];
};

export const WHERE_PARENT_ORDER_ONLY = {
  vendorShopOrders: { none: {} },
} as Prisma.OrderWhereInput;
