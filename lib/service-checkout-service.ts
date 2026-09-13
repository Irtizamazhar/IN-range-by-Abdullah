import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/marketplace-api";
import { serviceAmounts } from "@/lib/service-money";
export async function resolveServiceAddon(tx: Prisma.TransactionClient, productId: string, serviceId: string, quantity: number, city: string) {
  const addon = await tx.productServiceAddon.findUnique({ where: { productId_serviceId: { productId, serviceId } }, include: { service: { include: { vendor: { select: { status: true } } } }, product: { select: { isActive: true, vendorPublication: { select: { vendorId: true, status: true } } } } } });
  if (!addon?.active || !addon.service.active || !addon.product.isActive || addon.service.vendor.status !== "approved" || addon.product.vendorPublication?.vendorId !== addon.service.vendorId || addon.product.vendorPublication.status !== "active") throw new ApiError(409, "Service is no longer available for this product.");
  const service = addon.service;
  if (!Array.isArray(service.cities) || !service.cities.some(c => typeof c === "string" && c.toLowerCase() === city.trim().toLowerCase())) throw new ApiError(400, "Service is unavailable in your delivery city.");
  const config = await tx.commissionSetting.findUnique({ where: { categoryName: "Services" } });
  if (!config || Number(config.commissionPercentage) < 0 || Number(config.commissionPercentage) > 100) throw new ApiError(409, "Service checkout is awaiting platform commission configuration.");
  const amount = serviceAmounts(service.price, quantity, config.commissionPercentage);
  return { vendorId: service.vendorId, serviceId, productId, quantity, price: service.price, commissionRate: config.commissionPercentage, commissionAmount: amount.commission, vendorPayable: amount.payable,
    snapshot: { name: service.name, description: service.description, unitPrice: service.price.toString(), total: amount.gross.toString(), commission: amount.commission.toString(), vendorPayable: amount.payable.toString(), city, durationMinutes: service.durationMinutes, leadDays: service.leadDays, warranty: service.warranty, cancellationTerms: service.cancellationTerms, currency: "PKR" } };
}