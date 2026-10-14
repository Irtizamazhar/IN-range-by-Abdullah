import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RETURN_INCLUDE } from "@/lib/after-sales";
import { toCents } from "@/lib/payout-allocation";
import {
  calculateRefundPaymentStatus,
  calculateVendorRefundDebitCents,
  calculateCouponFundingReversalCents,
  grossUpPlatformRefundCents,
} from "@/lib/refund-math";
import { createCustomerNotification } from "@/lib/customer-notifications";

export async function createPendingRefund(params: {
  returnRequestId: string;
  amount: number;
  adminId: string;
  adminNote?: string | null;
}) {
  const amountCents = toCents(params.amount);
  if (amountCents <= 0) throw new Error("INVALID_AMOUNT");

  return prisma.$transaction(
    async (tx) => {
      const request = await tx.returnRequest.findUnique({
        where: { id: params.returnRequestId },
        include: { orderItem: true, refund: true },
      });
      if (!request) throw new Error("NOT_FOUND");
      if (request.refund) return request.refund;
      if (request.status !== "received") throw new Error("INVALID_STATE");

      const redemption = await tx.couponRedemption.findUnique({ where: { orderId: request.orderId } });
      const snapshot = redemption?.snapshot as { fundingType?: string; allocations?: Array<{ orderItemId?: string; discount?: number; base?: number }> } | undefined;
      const allocation = snapshot?.allocations?.find(a => a.orderItemId === request.orderItemId);
      const lineDiscountCents = allocation ? toCents(String(allocation.discount || 0)) : 0;
      const quantity = request.orderItem.quantity;
      const allocatedDiscount = Math.round(lineDiscountCents * request.quantity / quantity);
      const previousRefunds = await tx.refund.aggregate({ where: { orderId: request.orderId, returnRequest: { orderItemId: request.orderItemId }, status: { in: ["pending", "processed"] } }, _sum: { amount: true } });
      const linePaidCents = toCents(request.orderItem.price.toString()) * quantity - lineDiscountCents;
      const remainingCents = linePaidCents - toCents(previousRefunds._sum.amount?.toString() || "0");
      const maximumCents = Math.min(toCents(request.orderItem.price.toString()) * request.quantity - allocatedDiscount, remainingCents);
      if (amountCents > maximumCents) throw new Error("AMOUNT_EXCEEDS_LINE");

      const refund = await tx.refund.create({
        data: {
          customerId: request.customerId,
          orderId: request.orderId,
          returnRequestId: request.id,
          vendorId: request.vendorId,
          amount: new Prisma.Decimal((amountCents / 100).toFixed(2)),
          method: "manual",
          status: "pending",
          idempotencyKey: `return:${request.id}`,
          adminNote: params.adminNote || null,
        },
      });
      const gate = await tx.returnRequest.updateMany({
        where: { id: request.id, status: "received" },
        data: { status: "refund_pending", adminNote: params.adminNote || null },
      });
      if (gate.count !== 1) throw new Error("INVALID_STATE");
      await tx.orderStatusEvent.create({
        data: {
          orderId: request.orderId,
          actorType: "admin",
          actorId: params.adminId,
          eventType: "refund_created",
          idempotencyKey: `refund-created:${refund.id}`,
          details: { refundId: refund.id, amount: amountCents / 100 },
        },
      });
      await createCustomerNotification({
        customerId: request.customerId,
        type: "refund_pending",
        title: "Your refund was approved",
        message: `A refund of Rs. ${(amountCents / 100).toLocaleString("en-PK")} is awaiting transfer.`,
        link: "/my-stuff",
        idempotencyKey: `refund-created:${refund.id}:customer`,
      }, tx);
      return refund;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function processManualRefund(params: {
  refundId: string;
  externalRef: string;
  adminId: string;
  adminNote?: string | null;
  restock: boolean;
}) {
  const externalRef = params.externalRef.trim();
  if (externalRef.length < 3 || externalRef.length > 191) {
    throw new Error("INVALID_REFERENCE");
  }

  return prisma.$transaction(
    async (tx) => {
      const refund = await tx.refund.findUnique({
        where: { id: params.refundId },
        include: {
          returnRequest: {
            include: {
              orderItem: {
                include: {
                  inventoryLine: true,
                },
              },
            },
          },
          order: { select: { totalAmount: true, paymentStatus: true } },
        },
      });
      if (!refund) throw new Error("NOT_FOUND");
      if (refund.status === "processed") {
        if (refund.externalRef === externalRef) return refund;
        throw new Error("ALREADY_PROCESSED");
      }
      if (refund.status !== "pending" || refund.returnRequest.status !== "refund_pending") {
        throw new Error("INVALID_STATE");
      }
      if (refund.order.paymentStatus !== "received") throw new Error("PAYMENT_NOT_RECEIVED");

      const couponRedemption = await tx.couponRedemption.findUnique({ where: { orderId: refund.orderId } });
      const couponSnapshot = couponRedemption?.snapshot as { fundingType?: string; allocations?: Array<{ orderItemId?: string; discount?: number; base?: number }> } | undefined;
      const couponAllocation = couponSnapshot?.allocations?.find(a => a.orderItemId === refund.returnRequest.orderItemId);
      let platformReversalCents = 0;
      if (couponSnapshot?.fundingType === "PLATFORM_FUNDED" && couponAllocation) {
        const discountCents = toCents(String(couponAllocation.discount || 0));
        const paidCents = toCents(String(couponAllocation.base || 0)) - discountCents;
        const previous = await tx.refund.aggregate({ where: { orderId: refund.orderId, returnRequest: { orderItemId: refund.returnRequest.orderItemId }, status: "processed" }, _sum: { couponPlatformReversal: true } });
        platformReversalCents = calculateCouponFundingReversalCents({ discountCents, customerPaidCents: paidCents, customerRefundCents: toCents(refund.amount.toString()), alreadyReversedCents: toCents(previous._sum.couponPlatformReversal?.toString() || "0") });
      }

      const gate = await tx.refund.updateMany({
        where: { id: refund.id, status: "pending" },
        data: {
          status: "processed",
          couponPlatformReversal: new Prisma.Decimal((platformReversalCents / 100).toFixed(2)),
          externalRef,
          processedBy: params.adminId,
          adminNote: params.adminNote || refund.adminNote,
          processedAt: new Date(),
        },
      });
      if (gate.count !== 1) throw new Error("INVALID_STATE");

      await tx.returnRequest.update({
        where: { id: refund.returnRequestId },
        data: { status: "refunded", activeKey: null, closedAt: new Date() },
      });

      const warranty = await tx.warrantyRecord.findUnique({
        where: { orderItemId: refund.returnRequest.orderItemId },
      });
      if (warranty && warranty.status === "active") {
        const remaining = Math.max(0, warranty.quantity - refund.returnRequest.quantity);
        await tx.warrantyRecord.update({
          where: { id: warranty.id },
          data: {
            quantity: remaining,
            status: remaining === 0 ? "void" : "active",
            voidedAt: remaining === 0 ? new Date() : null,
          },
        });
      }

      const processed = await tx.refund.aggregate({
        where: { orderId: refund.orderId, status: "processed" },
        _sum: { amount: true },
      });
      const paymentStatus = calculateRefundPaymentStatus(
        toCents(processed._sum.amount?.toString() ?? "0"),
        toCents(refund.order.totalAmount.toString())
      );
      await tx.order.update({
        where: { id: refund.orderId },
        data: { paymentStatus },
      });

      const inventory = refund.returnRequest.orderItem.inventoryLine;
      if (params.restock && inventory) {
        if (inventory.productId) {
          await tx.product.updateMany({
            where: { id: inventory.productId },
            data: { stock: { increment: refund.returnRequest.quantity } },
          });
        }
        if (inventory.vendorProductId) {
          const vendorProduct = await tx.vendorProduct.findUnique({
            where: { id: inventory.vendorProductId },
            select: { totalSold: true },
          });
          if (vendorProduct) {
            await tx.vendorProduct.update({
              where: { id: inventory.vendorProductId },
              data: {
                stock: { increment: refund.returnRequest.quantity },
                totalSold: {
                  decrement: Math.min(
                    refund.returnRequest.quantity,
                    vendorProduct.totalSold
                  ),
                },
              },
            });
          }
        }
      }

      if (refund.vendorId) {
        const earning = inventory?.vendorShopOrderId
          ? await tx.vendorEarning.findUnique({
              where: { vendorShopOrderId: inventory.vendorShopOrderId },
            })
          : null;
        let debit = refund.amount;
        if (earning && inventory?.vendorProductId) {
          const vendorLine = await tx.vendorOrder.findFirst({
            where: {
              orderId: refund.orderId,
              vendorProductId: inventory.vendorProductId,
              vendorId: refund.vendorId,
            },
            select: { saleAmount: true, vendorAmount: true },
          });
          if (vendorLine && Number(vendorLine.saleAmount) > 0) {
            const redemption = await tx.couponRedemption.findUnique({ where: { orderId: refund.orderId } });
            const snapshot = redemption?.snapshot as { fundingType?: string; allocations?: Array<{ orderItemId?: string; discount?: number; base?: number }> } | undefined;
            const allocation = snapshot?.allocations?.find(a => a.orderItemId === refund.returnRequest.orderItemId);
            const lineBase = allocation ? toCents(String(allocation.base || 0)) : toCents(vendorLine.saleAmount.toString());
            const linePaid = lineBase - (allocation ? toCents(String(allocation.discount || 0)) : 0);
            const adjustedRefund = snapshot?.fundingType === "PLATFORM_FUNDED" && linePaid > 0
              ? grossUpPlatformRefundCents(toCents(refund.amount.toString()), lineBase, linePaid)
              : toCents(refund.amount.toString());
            const debitCents = calculateVendorRefundDebitCents({
              customerRefundCents: adjustedRefund,
              lineSaleCents: toCents(vendorLine.saleAmount.toString()),
              lineVendorCents: toCents(vendorLine.vendorAmount.toString()),
            });
            const earlier = await tx.refund.findMany({ where: { orderId: refund.orderId, id: { not: refund.id }, status: "processed", returnRequest: { orderItemId: refund.returnRequest.orderItemId } }, select: { id: true } });
            const earlierDebits = earlier.length ? await tx.vendorLedgerEntry.aggregate({ where: { vendorId: refund.vendorId, idempotencyKey: { in: earlier.map(row => `refund:${row.id}`) }, type: "refund_debit" }, _sum: { amount: true } }) : null;
            const remainingDebit = Math.max(0, toCents(vendorLine.vendorAmount.toString()) + toCents(earlierDebits?._sum.amount?.toString() || "0"));
            debit = new Prisma.Decimal((Math.min(debitCents, remainingDebit) / 100).toFixed(2));
          }
        }
        await tx.vendorLedgerEntry.create({
          data: {
            vendorId: refund.vendorId,
            earningId: earning?.id ?? null,
            type: "refund_debit",
            amount: debit.negated(),
            idempotencyKey: `refund:${refund.id}`,
            details: {
              refundId: refund.id,
              returnRequestId: refund.returnRequestId,
              customerRefund: Number(refund.amount),
            },
          },
        });
        await tx.vendorNotification.create({
          data: {
            vendorId: refund.vendorId,
            type: "refund_processed",
            title: "Return refund processed",
            message: `A refund of Rs. ${Number(refund.amount).toLocaleString("en-PK")} was recorded for an order item.`,
          },
        });
      }

      await tx.orderStatusEvent.create({
        data: {
          orderId: refund.orderId,
          actorType: "admin",
          actorId: params.adminId,
          eventType: "refund_processed",
          idempotencyKey: `refund-processed:${refund.id}`,
          details: {
            refundId: refund.id,
            amount: Number(refund.amount),
            externalRef,
            restocked: params.restock,
          },
        },
      });
      await createCustomerNotification({
        customerId: refund.customerId,
        type: "refund_processed",
        title: "Refund transfer completed",
        message: `Rs. ${Number(refund.amount).toLocaleString("en-PK")} was processed. Reference: ${externalRef}`,
        link: "/my-stuff",
        idempotencyKey: `refund-processed:${refund.id}:customer`,
      }, tx);
      return tx.refund.findUniqueOrThrow({ where: { id: refund.id } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function getReturnForAdmin(id: string) {
  return prisma.returnRequest.findUnique({ where: { id }, include: RETURN_INCLUDE });
}
