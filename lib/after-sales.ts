import type { Prisma } from "@prisma/client";

export const RETURN_INCLUDE = {
  order: { select: { id: true, orderNumber: true, orderStatus: true, paymentStatus: true } },
  orderItem: {
    select: { id: true, name: true, image: true, price: true, quantity: true, variant: true },
  },
  vendor: { select: { id: true, shopName: true } },
  refund: true,
} satisfies Prisma.ReturnRequestInclude;

export type ReturnWithDetails = Prisma.ReturnRequestGetPayload<{
  include: typeof RETURN_INCLUDE;
}>;

export function serializeReturn(row: ReturnWithDetails) {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.order.orderNumber,
    orderStatus: row.order.orderStatus,
    paymentStatus: row.order.paymentStatus,
    orderItemId: row.orderItemId,
    productName: row.orderItem.name,
    productImage: row.orderItem.image,
    unitPrice: Number(row.orderItem.price),
    orderedQuantity: row.orderItem.quantity,
    quantity: row.quantity,
    variant: row.orderItem.variant,
    vendorId: row.vendorId,
    shopName: row.vendor?.shopName ?? "InRange",
    reason: row.reason,
    details: row.details,
    status: row.status,
    customerTracking: row.customerTracking,
    vendorNote: row.vendorNote,
    adminNote: row.adminNote,
    requestedAt: row.requestedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    refund: row.refund
      ? {
          id: row.refund.id,
          amount: Number(row.refund.amount),
          method: row.refund.method,
          status: row.refund.status,
          externalRef: row.refund.externalRef,
          adminNote: row.refund.adminNote,
          processedAt: row.refund.processedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export const DISPUTE_INCLUDE = {
  order: { select: { id: true, orderNumber: true, orderStatus: true, paymentStatus: true } },
  vendor: { select: { id: true, shopName: true } },
  returnRequest: { select: { id: true, status: true, reason: true } },
} satisfies Prisma.DisputeInclude;

export type DisputeWithDetails = Prisma.DisputeGetPayload<{
  include: typeof DISPUTE_INCLUDE;
}>;

export function serializeDispute(row: DisputeWithDetails) {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.order.orderNumber,
    orderStatus: row.order.orderStatus,
    paymentStatus: row.order.paymentStatus,
    returnRequestId: row.returnRequestId,
    returnStatus: row.returnRequest?.status ?? null,
    vendorId: row.vendorId,
    shopName: row.vendor?.shopName ?? "InRange",
    type: row.type,
    message: row.message,
    status: row.status,
    resolution: row.resolution,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

export function isPrismaUniqueError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      String((error as { code: unknown }).code) === "P2002"
  );
}
