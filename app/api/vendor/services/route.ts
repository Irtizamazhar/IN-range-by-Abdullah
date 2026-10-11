import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { api, ApiError, sameOrigin } from "@/lib/marketplace-api";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { isServiceType, SERVICE_TYPES } from "@/lib/service-types";
export const dynamic = "force-dynamic";
const input = z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(5000), type: z.string().trim().min(1).max(100), price: z.number().positive().max(9999999), cities: z.array(z.string().trim().min(1).max(100)).min(1).max(100), durationMinutes: z.number().int().min(1).max(10080), leadDays: z.number().int().min(0).max(365), warranty: z.string().max(1000), cancellationTerms: z.string().min(1).max(5000), active: z.boolean() });
export async function GET() { return api(async () => {
  const s = await getVendorFromSession(); if (!s) throw new ApiError(401, "Vendor sign-in required.");
  const [services, products, addons, bookingCount] = await Promise.all([
    prisma.serviceOffering.findMany({ where: { vendorId: s.vendor.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.product.findMany({ where: { vendorPublication: { vendorId: s.vendor.id } }, select: { id: true, name: true }, take: 500 }),
    prisma.productServiceAddon.findMany({ where: { product: { vendorPublication: { vendorId: s.vendor.id } }, service: { vendorId: s.vendor.id } }, select: { id: true, active: true, product: { select: { name: true } }, service: { select: { name: true } } }, take: 500 }),
    prisma.orderService.count({ where: { vendorId: s.vendor.id } }),
  ]);
  return { services, products, addons, bookingCount, serviceTypes: SERVICE_TYPES };
}); }
export async function POST(request: Request) { return api(async () => {
  sameOrigin(request); const s = await getVendorFromSession(); if (!s || s.vendor.status !== "approved") throw new ApiError(403, "Approved vendor required."); const body = await request.json();
  return prisma.$transaction(async tx => {
    if (body.action === "attach") {
      const data = z.object({ productId: z.string(), serviceId: z.string(), active: z.boolean() }).parse(body);
      const service = await tx.serviceOffering.findFirst({ where: { id: data.serviceId, vendorId: s.vendor.id, moderationStatus: "APPROVED" }, select: { id: true } });
      const product = await tx.product.findFirst({ where: { id: data.productId, vendorPublication: { vendorId: s.vendor.id } }, select: { id: true } });
      if (!service || !product) throw new ApiError(403, "Product and service must belong to your store.");
      return { addon: await tx.productServiceAddon.upsert({ where: { productId_serviceId: { productId: data.productId, serviceId: data.serviceId } }, create: data, update: { active: data.active } }) };
    }
    const { id, ...data } = input.parse(body);
    if (!isServiceType(data.type)) {
      const legacy = id && await tx.serviceOffering.findFirst({ where: { id, vendorId: s.vendor.id }, select: { type: true } });
      if (!legacy || legacy.type !== data.type) throw new ApiError(400, "Choose an approved service type.");
    }
    if (id) { const result = await tx.serviceOffering.updateMany({ where: { id, vendorId: s.vendor.id, moderationStatus: "APPROVED" }, data }); if (!result.count) throw new ApiError(403, "This service is unavailable for editing. Contact support if it was hidden by an administrator."); return { success: true }; }
    return { service: await tx.serviceOffering.create({ data: { ...data, vendorId: s.vendor.id } }) };
  });
}); }
