import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";
import { serviceAmounts } from "@/lib/service-money";
import { findServiceCommissionRange } from "@/lib/service-commission-ranges";
export async function resolveServiceAddon(tx: Prisma.TransactionClient, productId: string, serviceId: string, quantity: number, city: string) {
  const addon = await tx.productServiceAddon.findUnique({ where: { productId_serviceId: { productId, serviceId } }, include: { service: { include: { vendor: { select: { status: true } } } }, product: { select: { isActive: true, vendorPublication: { select: { vendorId: true, status: true } } } } } });
  if (!addon?.active || !addon.service.active || addon.service.moderationStatus !== "APPROVED" || !addon.product.isActive || addon.service.vendor.status !== "approved" || addon.product.vendorPublication?.vendorId !== addon.service.vendorId || addon.product.vendorPublication.status !== "active") throw new ApiError(409, "Service is no longer available for this product.");
  const service = addon.service;
  if (!Array.isArray(service.cities) || !service.cities.some(c => typeof c === "string" && c.toLowerCase() === city.trim().toLowerCase())) throw new ApiError(400, "Service is unavailable in your delivery city.");
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new ApiError(400, "Invalid service quantity.");
  // Commission base and range key: the service line only (unit price × quantity) — no product, delivery, handling fee or coupon.
  const gross = service.price.mul(quantity).toDecimalPlaces(2);
  const ranges = await tx.serviceCommissionRange.findMany({ where: { isActive: true }, orderBy: { minAmount: "asc" } });
  const range = findServiceCommissionRange(ranges.map(r => ({ ...r, minAmount: r.minAmount.toString(), maxAmount: r.maxAmount.toString() })), gross.toString());
  if (!range || range.commissionPercentage.lt(0) || range.commissionPercentage.gt(100)) {
    console.warn("[service-commission] no commission range for service amount", { serviceId, amount: gross.toString(), activeRanges: ranges.length });
    throw new ApiError(409, "This service can't be booked right now because no commission rate is configured for its price. Please contact support.");
  }
  const amount = serviceAmounts(service.price, quantity, range.commissionPercentage);
  return { vendorId: service.vendorId, serviceId, productId, quantity, price: service.price, commissionRate: range.commissionPercentage, commissionAmount: amount.commission, vendorPayable: amount.payable,
    snapshot: { name: service.name, description: service.description, unitPrice: service.price.toString(), total: amount.gross.toString(), commission: amount.commission.toString(), vendorPayable: amount.payable.toString(), commissionRange: { min: range.minAmount, max: range.maxAmount, rate: range.commissionPercentage.toString() }, city, durationMinutes: service.durationMinutes, leadDays: service.leadDays, warranty: service.warranty, cancellationTerms: service.cancellationTerms, currency: "PKR" } };
}
