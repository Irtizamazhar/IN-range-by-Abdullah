import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";

export function isQuoteService(job: { serviceId: string | null; productId: string | null; snapshot: Prisma.JsonValue }) {
  const snapshot = job.snapshot as { kind?: string } | null;
  return job.serviceId === null && job.productId === null && snapshot?.kind === "ACCEPTED_SERVICE_QUOTE";
}

/** Existing manual receipt authorization stays in the order-management API. Completion never collects payment. */
export async function settleCompletedQuoteServices(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true, orderStatus: true } });
  if (!order || order.paymentStatus !== "received" || order.orderStatus === "cancelled") return;
  const jobs = await tx.orderService.findMany({ where: { orderId, serviceId: null, productId: null, status: "COMPLETED" }, include: { order: { select: { offerQuote: { select: { id: true, revision: { select: { offer: { select: { vendorId: true } } } } } } } } } });
  for (const job of jobs) {
    const snapshot = job.snapshot as { quoteId?: string };
    if (!isQuoteService(job) || !job.order.offerQuote || snapshot.quoteId !== job.order.offerQuote.id || job.vendorId !== job.order.offerQuote.revision.offer.vendorId) throw new ApiError(409, "Service provider attribution needs administrative review.");
    const earning = await tx.vendorEarning.upsert({ where: { orderServiceId: job.id }, update: {}, create: { orderServiceId: job.id, vendorId: job.vendorId, orderId, saleAmount: job.price.mul(job.quantity), commissionRate: job.commissionRate, commissionAmount: job.commissionAmount, vendorAmount: job.vendorPayable, status: "pending" } });
    await tx.vendorLedgerEntry.upsert({ where: { idempotencyKey: `earning:${earning.id}` }, update: {}, create: { vendorId: job.vendorId, earningId: earning.id, type: "earning_credit", amount: job.vendorPayable, idempotencyKey: `earning:${earning.id}`, details: { orderServiceId: job.id, quoteId: snapshot.quoteId } } });
  }
}

export async function advanceQuoteService(tx: Prisma.TransactionClient, id: string, input: { status: string; scheduledAt?: string; note: string; role: "customer" | "vendor" | "admin" }, actor: string, vendorId?: string, customerId?: string) {
  const job = await tx.orderService.findUnique({ where: { id }, include: { order: { select: { id: true, customerId: true, orderStatus: true, paymentStatus: true, updatedAt: true, offerQuote: { select: { id: true, revision: { select: { offer: { select: { vendorId: true } } } } } } } } } });
  if (!job || !isQuoteService(job) || (vendorId && job.vendorId !== vendorId) || (customerId && job.order.customerId !== customerId)) throw new ApiError(404, "Booking not found.");
  if (job.vendorId !== job.order.offerQuote?.revision.offer.vendorId || (job.snapshot as { quoteId?: string }).quoteId !== job.order.offerQuote.id) throw new ApiError(409, "Service provider attribution needs administrative review.");
  if (job.order.orderStatus === "cancelled") throw new ApiError(409, "This service order is cancelled.");
  if (job.status === input.status && !input.scheduledAt) return { success: true };
  if (["COMPLETED", "CANCELLED", "FAILED"].includes(job.status)) throw new ApiError(409, "Booking is closed.");
  if (input.role === "customer" && input.status !== "SCHEDULE_REQUIRED") throw new ApiError(403, "Customers may request scheduling. Contact support for completion or cancellation.");
  if (["CANCELLED", "FAILED"].includes(input.status) && input.role !== "admin") throw new ApiError(403, "An administrator must review cancellation or failure.");
  const transitions: Record<string, string[]> = { PENDING: ["CONFIRMED", "SCHEDULE_REQUIRED", "CANCELLED", "FAILED"], CONFIRMED: ["SCHEDULE_REQUIRED", "SCHEDULED", "CANCELLED", "FAILED"], SCHEDULE_REQUIRED: ["SCHEDULE_REQUIRED", "SCHEDULED", "CANCELLED", "FAILED"], SCHEDULED: ["SCHEDULE_REQUIRED", "IN_PROGRESS", "CANCELLED", "FAILED"], IN_PROGRESS: ["COMPLETED", "CANCELLED", "FAILED"] };
  if (!transitions[job.status]?.includes(input.status)) throw new ApiError(409, "Invalid service status transition.");
  if (["SCHEDULED", "SCHEDULE_REQUIRED"].includes(input.status) && (!input.scheduledAt || new Date(input.scheduledAt) <= new Date())) throw new ApiError(400, "Choose a future service date.");
  const lock = await tx.order.updateMany({ where: { id: job.orderId, updatedAt: job.order.updatedAt, orderStatus: { not: "cancelled" } }, data: { updatedAt: new Date() } });
  if (lock.count !== 1) throw new ApiError(409, "Order changed. Refresh the booking.");
  const changed = await tx.orderService.updateMany({ where: { id: job.id, status: job.status, updatedAt: job.updatedAt }, data: { status: input.status, ...(input.scheduledAt ? { scheduledAt: new Date(input.scheduledAt) } : {}), ...(["CANCELLED", "FAILED"].includes(input.status) ? { refundStatus: "REVIEW_REQUIRED" } : {}) } });
  if (changed.count !== 1) throw new ApiError(409, "Booking changed. Refresh and retry.");
  await tx.serviceEvent.create({ data: { orderServiceId: job.id, actor, status: input.status, note: input.note } });
  await tx.orderStatusEvent.create({ data: { orderId: job.orderId, actorType: input.role, actorId: actor, eventType: "service_status_changed", fromStatus: job.status, toStatus: input.status, details: { orderServiceId: job.id, note: input.note } } });
  if (input.status === "COMPLETED") {
    // Parent "delivered" is the existing fulfilled state; no shipped/tracking/pickup is created.
    await tx.order.update({ where: { id: job.orderId }, data: { orderStatus: "delivered" } });
    await settleCompletedQuoteServices(tx, job.orderId);
  }
  if (["CANCELLED", "FAILED"].includes(input.status)) await tx.order.update({ where: { id: job.orderId }, data: { orderStatus: "cancelled", cancelReason: input.note, cancelledAt: new Date() } });
  if (job.order.customerId) await tx.customerNotification.create({ data: { customerId: job.order.customerId, type: "service_status", title: `Service ${input.status.toLowerCase()}`, message: input.note, link: "/account/services", idempotencyKey: `service:${job.id}:${job.updatedAt.toISOString()}:${input.status}` } });
  return { success: true };
}
