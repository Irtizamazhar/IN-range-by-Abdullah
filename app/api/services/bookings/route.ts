import { customerServiceSnapshot } from "@/lib/customer-service-policy";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor, sameOrigin } from "@/lib/marketplace-api";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { getVendorFromSession } from "@/lib/vendor-auth-server";
import { advanceQuoteService, isQuoteService } from "@/lib/service-quote-fulfillment";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return api(async () => {
  const query = new URL(request.url).searchParams; const role = query.get("role"); let where: Prisma.OrderServiceWhereInput = {};
  const page = z.coerce.number().int().min(1).max(100000).parse(query.get("page") || 1);
  if (role === "admin") { const auth = await requireAdminPermission("orders.view"); if ("response" in auth) return auth.response; }
  else if (role === "vendor") { const s = await getVendorFromSession(); if (!s) throw new ApiError(401, "Vendor sign-in required."); where = { vendorId: s.vendor.id }; }
  else { const c = await customerActor(); where = { order: { customerId: c.id } }; }
  if (role === "admin") {
    const status = query.get("status"); if (status) where.status = z.enum(["PENDING", "CONFIRMED", "SCHEDULE_REQUIRED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "FAILED"]).parse(status);
    const search = (query.get("search") || "").trim().slice(0, 100); if (search) where.OR = [{ order: { orderNumber: { contains: search } } }, { vendor: { shopName: { contains: search } } }];
  }
  const total = role === "admin" ? await prisma.orderService.count({ where }) : undefined;
  const bookings = await prisma.orderService.findMany({ where, select: { id: true, serviceId: true, productId: true, status: true, scheduledAt: true, snapshot: true, refundStatus: true, order: { select: { id: true, orderNumber: true, paymentStatus: true } }, events: { select: { id: true, status: true, note: true, createdAt: true }, orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" }, take: role === "admin" ? 20 : 100, ...(role === "admin" ? { skip: (page - 1) * 20 } : {}) }); return { total, page, bookings: bookings.map(b => { const { serviceId, productId, ...row } = b; return { ...row, standalone: isQuoteService({ ...b, serviceId, productId }), ...(role === "admin" || role === "vendor" ? {} : { snapshot: customerServiceSnapshot(b.snapshot), events: b.events.map(({ id, status, createdAt }) => ({ id, status, createdAt })) }) }; }) };
}); }
export async function PATCH(request: Request) { return api(async () => {
  sameOrigin(request); const input = z.object({ id: z.string(), role: z.enum(["customer", "vendor", "admin"]), status: z.enum(["CONFIRMED", "SCHEDULE_REQUIRED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "FAILED"]), scheduledAt: z.string().datetime().optional(), note: z.string().trim().min(3).max(2000) }).parse(await request.json());
  let actor: string; let vendorId: string | undefined; let customerId: string | undefined;
  if (input.role === "admin") { const auth = await requireAdminPermission("orders.manage"); if ("response" in auth) return auth.response; actor = `admin:${auth.admin.id}`; }
  else if (input.role === "vendor") { const s = await getVendorFromSession(); if (!s || s.vendor.status !== "approved") throw new ApiError(403, "Approved vendor required."); vendorId = s.vendor.id; actor = `vendor:${vendorId}`; }
  else { const c = await customerActor(); customerId = c.id; actor = `customer:${c.id}`; }
  return prisma.$transaction(async tx => {
    const job = await tx.orderService.findUnique({ where: { id: input.id }, include: { order: { select: { customerId: true, orderStatus: true, paymentStatus: true, vendorShopOrders: { select: { vendorId: true, status: true } } } } } });
    if (!job || (vendorId && vendorId !== job.vendorId) || (customerId && customerId !== job.order.customerId)) throw new ApiError(404, "Booking not found.");
    if (isQuoteService(job)) return advanceQuoteService(tx, job.id, input, actor, vendorId, customerId);
    if (job.status === input.status && !input.scheduledAt) return { success: true };
    if (["COMPLETED","CANCELLED","FAILED"].includes(job.status)) throw new ApiError(409, "Booking is closed.");
    if (input.role === "customer" && input.status !== "SCHEDULE_REQUIRED") throw new ApiError(403, "Contact support for cancellation or completion confirmation.");
    if (["COMPLETED","CANCELLED","FAILED"].includes(input.status) && input.role !== "admin") throw new ApiError(403, "An administrator must review completion or cancellation.");
    const transitions: Record<string,string[]> = { PENDING: ["CONFIRMED","SCHEDULE_REQUIRED","CANCELLED","FAILED"], CONFIRMED: ["SCHEDULE_REQUIRED","SCHEDULED","CANCELLED","FAILED"], SCHEDULE_REQUIRED: ["SCHEDULE_REQUIRED","SCHEDULED","CANCELLED","FAILED"], SCHEDULED: ["SCHEDULE_REQUIRED","IN_PROGRESS","CANCELLED","FAILED"], IN_PROGRESS: ["COMPLETED","CANCELLED","FAILED"] };
    if (!transitions[job.status]?.includes(input.status)) throw new ApiError(409, "Invalid service status transition.");
    if (["SCHEDULED", "SCHEDULE_REQUIRED"].includes(input.status) && (!input.scheduledAt || new Date(input.scheduledAt) <= new Date())) throw new ApiError(400, "Choose a future service date.");
    if (input.status === "COMPLETED") {
      const delivered = job.order.vendorShopOrders.some(o => o.vendorId === job.vendorId && o.status === "delivered");
      if (!delivered || job.order.paymentStatus !== "received") throw new ApiError(409, "Confirm delivery and received payment before releasing service earnings.");
      await tx.vendorEarning.upsert({ where: { orderServiceId: job.id }, update: {}, create: { orderServiceId: job.id, vendorId: job.vendorId, orderId: job.orderId, saleAmount: job.price.mul(job.quantity), commissionRate: job.commissionRate, commissionAmount: job.commissionAmount, vendorAmount: job.vendorPayable, status: "pending" } });
    }
    await tx.orderService.update({ where: { id: job.id }, data: { status: input.status, ...(input.scheduledAt ? { scheduledAt: new Date(input.scheduledAt) } : {}), ...(input.status === "CANCELLED" ? { refundStatus: "REVIEW_REQUIRED" } : {}) } });
    await tx.serviceEvent.create({ data: { orderServiceId: job.id, actor, status: input.status, note: input.note } });
    return { success: true };
  }, { isolationLevel: "Serializable" });
}); }
