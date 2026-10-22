import { randomUUID } from "node:crypto";
import { Prisma, type PickupStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/marketplace-api";
import { appendStatusHistory, syncLineOrdersToShopStatus } from "@/lib/vendor-shop-order-helpers";
import { writeAdminAudit } from "@/lib/admin-rbac";
import { createCustomerNotification } from "@/lib/customer-notifications";

type PickupEvent = { status: PickupStatus; at: string; actor: string; note: string };
function history(raw: unknown, event: PickupEvent): Prisma.InputJsonValue {
  return [...(Array.isArray(raw) ? raw : []), event] as Prisma.InputJsonValue;
}
function savedPickup(raw: unknown, vendor: { address: string; city: string; ownerName: string; phone: string }) {
  const saved = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const value = (key: string, fallback: string) => typeof saved[key] === "string" && String(saved[key]).trim() ? String(saved[key]).trim() : fallback;
  return { pickupAddress: value("pickupAddress", vendor.address), pickupCity: value("pickupCity", vendor.city), contactName: value("pickupContactName", vendor.ownerName), contactPhone: value("pickupPhone", vendor.phone) };
}

export async function pickupPrefill(vendorId: string) {
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { shopName: true, address: true, city: true, ownerName: true, phone: true, onboardingData: true } });
  return { vendorName: vendor.shopName, ...savedPickup(vendor.onboardingData, vendor) };
}

export async function requestPickup(input: { shopOrderId: string; vendorId: string; parcelCount: number; weightKg?: number; preferredWindow?: string; instructions?: string }) {
  try {
    return await prisma.$transaction(async (tx) => {
    const shop = await tx.vendorShopOrder.findFirst({ where: { id: input.shopOrderId, vendorId: input.vendorId }, select: { status: true } });
    if (!shop) throw new ApiError(404, "Order not found.");
    if (shop.status !== "packed") throw new ApiError(409, "Only packed orders can request pickup.");
    const locked = await tx.vendorShopOrder.updateMany({ where: { id: input.shopOrderId, vendorId: input.vendorId, status: "packed" }, data: { status: "packed" } });
    if (locked.count !== 1) throw new ApiError(409, "Order changed; refresh and try again.");
    const existing = await tx.pickupRequest.findUnique({ where: { shopOrderId: input.shopOrderId } });
    if (existing) return existing;
    const vendor = await tx.vendor.findUniqueOrThrow({ where: { id: input.vendorId }, select: { address: true, city: true, ownerName: true, phone: true, onboardingData: true } });
    const location = savedPickup(vendor.onboardingData, vendor);
    if (!location.pickupAddress || !location.pickupCity || !location.contactName || !location.contactPhone) throw new ApiError(409, "Complete your saved pickup address and contact details first.");
    const now = new Date();
    return tx.pickupRequest.create({ data: {
      id: `pick_${randomUUID()}`, pickupReference: `JPK-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      shopOrderId: input.shopOrderId, vendorId: input.vendorId, ...location,
      parcelCount: input.parcelCount, weightKg: input.weightKg, preferredWindow: input.preferredWindow, instructions: input.instructions,
      packedConfirmed: true, status: "ready", readyAt: now, history: [{ status: "ready", at: now.toISOString(), actor: input.vendorId, note: "Vendor confirmed packed and sealed" }],
    } });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const existing = await prisma.pickupRequest.findUnique({ where: { shopOrderId: input.shopOrderId } });
      if (existing && existing.status !== "cancelled") return existing;
      if (existing) throw new ApiError(409, "Order pickup was cancelled; refresh the order.");
    }
    throw error;
  }
}

/** Admin recovery creates only a request; collection and handover still use the normal gates. */
export async function recoverLegacyPickup(input: { shopOrderId: string; adminId: string; pickupAddress: string; pickupCity: string; contactName: string; contactPhone: string; parcelCount: number; reason: string; evidence: string }) {
  try { return await prisma.$transaction(async (tx) => {
    const shop = await tx.vendorShopOrder.findUnique({ where: { id: input.shopOrderId }, select: { vendorId: true, status: true } });
    if (!shop) throw new ApiError(404, "Seller order not found.");
    if (shop.status !== "packed") throw new ApiError(409, "Only packed orders can enter pickup recovery.");
    const locked = await tx.vendorShopOrder.updateMany({ where: { id: input.shopOrderId, status: "packed" }, data: { status: "packed" } });
    if (locked.count !== 1) throw new ApiError(409, "Order changed; refresh and try again.");
    if (await tx.pickupRequest.findUnique({ where: { shopOrderId: input.shopOrderId } })) throw new ApiError(409, "A pickup request already exists for this order.");
    const now = new Date();
    const pickup = await tx.pickupRequest.create({ data: {
      id: `pick_${randomUUID()}`, pickupReference: `JPK-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      shopOrderId: input.shopOrderId, vendorId: shop.vendorId,
      pickupAddress: input.pickupAddress, pickupCity: input.pickupCity, contactName: input.contactName, contactPhone: input.contactPhone,
      parcelCount: input.parcelCount, packedConfirmed: true, status: "ready", readyAt: now,
      history: [{ status: "ready", at: now.toISOString(), actor: input.adminId, note: `Admin recovery: ${input.reason}; evidence: ${input.evidence}` }],
    } });
    await writeAdminAudit(tx, { adminId: input.adminId, action: "pickup.legacy.recovered", entityType: "PickupRequest", entityId: pickup.id, details: { shopOrderId: input.shopOrderId, reason: input.reason, evidence: input.evidence, pickupAddress: input.pickupAddress, pickupCity: input.pickupCity, contactName: input.contactName, contactPhone: input.contactPhone, parcelCount: input.parcelCount } });
    return pickup;
  }); } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new ApiError(409, "A pickup request already exists; refresh the order.");
    throw error;
  }
}

export async function schedulePickup(input: { requestIds: string[]; scheduledAt: Date; courierName?: string; agentName?: string; adminId: string }) {
  return prisma.$transaction(async (tx) => {
    const requests = await tx.pickupRequest.findMany({ where: { id: { in: input.requestIds } }, include: { shopOrder: { select: { status: true } } } });
    if (requests.length !== input.requestIds.length || requests.some(r => r.visitId || !["ready", "failed"].includes(r.status) || r.shopOrder.status !== "packed")) throw new ApiError(409, "Refresh the pickup queue; an order changed.");
    const first = requests[0]!;
    if (requests.some(r => r.vendorId !== first.vendorId || r.pickupAddress !== first.pickupAddress || r.pickupCity !== first.pickupCity || r.contactName !== first.contactName || r.contactPhone !== first.contactPhone)) throw new ApiError(400, "A visit can only group one vendor at one pickup address and contact.");
    const now = new Date();
    const status: PickupStatus = input.courierName || input.agentName ? "assigned" : "scheduled";
    const visit = await tx.pickupVisit.create({ data: {
      id: `visit_${randomUUID()}`, vendorId: first.vendorId, pickupAddress: first.pickupAddress, pickupCity: first.pickupCity,
      contactName: first.contactName, contactPhone: first.contactPhone, scheduledAt: input.scheduledAt,
      courierName: input.courierName, agentName: input.agentName, status,
      history: [{ status, at: now.toISOString(), actor: input.adminId, note: "Pickup scheduled" }],
    } });
    for (const request of requests) {
      const gate = await tx.pickupRequest.updateMany({ where: { id: request.id, visitId: null, status: request.status }, data: { visitId: visit.id, status, failedReason: null, history: history(request.history, { status, at: now.toISOString(), actor: input.adminId, note: "Pickup scheduled" }) } });
      if (gate.count !== 1) throw new ApiError(409, "A pickup changed; refresh and try again.");
    }
    await writeAdminAudit(tx, { adminId: input.adminId, action: "pickup.visit.scheduled", entityType: "PickupVisit", entityId: visit.id, details: { requestIds: input.requestIds } });
    return visit;
  });
}

export async function updatePickupVisit(input: { visitId: string; adminId: string; action: "assign" | "reschedule" | "fail" | "collect" | "handover"; scheduledAt?: Date; courierName?: string; agentName?: string; reason?: string; exceptionEvidence?: string; handoverReference?: string; trackingNumbers?: Record<string, string> }) {
  return prisma.$transaction(async (tx) => {
    const visit = await tx.pickupVisit.findUnique({ where: { id: input.visitId }, include: { requests: { include: { shopOrder: { select: { status: true, statusHistory: true, customerId: true, orderId: true, shopOrderNumber: true } } } } } });
    if (!visit) throw new ApiError(404, "Pickup visit not found.");
    const allowed: Record<typeof input.action, PickupStatus[]> = { assign: ["scheduled", "assigned", "failed"], reschedule: ["scheduled", "assigned", "failed"], fail: ["scheduled", "assigned"], collect: ["scheduled", "assigned"], handover: ["collected"] };
    if (!allowed[input.action].includes(visit.status) || visit.requests.length === 0) throw new ApiError(409, "Pickup state changed; refresh and try again.");
    const activeRequests = visit.requests.filter(r => r.status !== "cancelled");
    if (!activeRequests.length || activeRequests.some(r => r.shopOrder.status !== "packed")) throw new ApiError(409, "A grouped order is no longer packed; resolve it before advancing this visit.");
    if (input.action === "collect" && !input.courierName && !input.agentName && !visit.courierName && !visit.agentName && (!input.reason?.trim() || !input.exceptionEvidence?.trim())) throw new ApiError(400, "Assign a courier or agent, or record a reason and collection evidence for the exception.");
    const next: PickupStatus = input.action === "assign" ? "assigned" : input.action === "reschedule" ? (input.courierName || input.agentName || visit.courierName || visit.agentName ? "assigned" : "scheduled") : input.action === "fail" ? "failed" : input.action === "collect" ? "collected" : "handed_over";
    const now = new Date();
    const event = { status: next, at: now.toISOString(), actor: input.adminId, note: input.action === "collect" && input.exceptionEvidence ? `Collection exception: ${input.reason}; evidence: ${input.exceptionEvidence}` : input.reason || input.action };
    const gate = await tx.pickupVisit.updateMany({ where: { id: visit.id, status: visit.status, updatedAt: visit.updatedAt }, data: {
      status: next, history: history(visit.history, event),
      ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
      ...(input.courierName !== undefined ? { courierName: input.courierName } : {}),
      ...(input.agentName !== undefined ? { agentName: input.agentName } : {}),
      ...(input.action === "fail" ? { failedReason: input.reason } : { failedReason: null }),
      ...(input.action === "collect" ? { collectedAt: now } : {}),
      ...(input.action === "handover" ? { handoverAt: now, handoverReference: input.handoverReference } : {}),
    } });
    if (gate.count !== 1) throw new ApiError(409, "Pickup changed; refresh and try again.");
    for (const request of activeRequests) {
      const trackingNumber = input.trackingNumbers?.[request.id]?.trim();
      if (input.action === "handover" && !trackingNumber) throw new ApiError(400, "A tracking number is required for each order at handover.");
      const requestGate = await tx.pickupRequest.updateMany({ where: { id: request.id, status: request.status, visitId: visit.id, updatedAt: request.updatedAt }, data: {
        status: next, history: history(request.history, event), failedReason: input.action === "fail" ? input.reason : null,
        ...(input.action === "collect" ? { collectedAt: now } : {}),
        ...(input.action === "handover" ? { handoverAt: now, handoverReference: input.handoverReference, trackingNumber } : {}),
      } });
      if (requestGate.count !== 1) throw new ApiError(409, "Pickup changed; refresh and try again.");
      if (input.action === "handover") {
        const shippedHistory = appendStatusHistory(request.shopOrder.statusHistory, { status: "shipped", updatedAt: now.toISOString(), note: `Courier handover ${input.handoverReference}` });
        const shipped = await tx.vendorShopOrder.updateMany({ where: { id: request.shopOrderId, status: "packed" }, data: { status: "shipped", statusHistory: shippedHistory as Prisma.InputJsonValue, trackingNumber } });
        if (shipped.count !== 1) throw new ApiError(409, "Order changed; refresh and try again.");
        await syncLineOrdersToShopStatus(tx, request.shopOrderId, "shipped", trackingNumber);
        if (request.shopOrder.customerId) await createCustomerNotification({ customerId: request.shopOrder.customerId, type: "seller_delivery_status", title: "Seller order shipped", message: `${request.shopOrder.shopOrderNumber} was handed to the courier. Tracking: ${trackingNumber}.`, link: `/track-order?order=${encodeURIComponent(request.shopOrder.shopOrderNumber)}`, idempotencyKey: `shop-status:${request.shopOrderId}:shipped` }, tx);
        if (request.shopOrder.customerId) await tx.orderConfirmationEmail.upsert({ where: { orderId_recipientKey: { orderId: request.shopOrder.orderId, recipientKey: `shipped:${request.shopOrderId}` } }, create: { orderId: request.shopOrder.orderId, recipientKey: `shipped:${request.shopOrderId}` }, update: {} });
      }
    }
    await writeAdminAudit(tx, { adminId: input.adminId, action: `pickup.visit.${input.action}`, entityType: "PickupVisit", entityId: visit.id, details: { requestIds: activeRequests.map(r => r.id), handoverReference: input.handoverReference ?? null, exceptionEvidence: input.exceptionEvidence ?? null, reason: input.reason ?? null } });
    return { visitId: visit.id, shippedOrderIds: input.action === "handover" ? activeRequests.map(r => r.shopOrderId) : [] };
  });
}
