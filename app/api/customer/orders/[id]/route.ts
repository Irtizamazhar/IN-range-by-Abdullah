import { prisma } from "@/lib/prisma";
import { api, ApiError, customerActor } from "@/lib/marketplace-api";
import { canCustomerCancelOrder } from "@/lib/customer-account-policy";
import { resolveCustomerOrderTrackStatus } from "@/lib/order-track-status";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) { return api(async () => {
  const c = await customerActor(); const order = await prisma.order.findFirst({ where: { id: params.id, customerId: c.id }, select: { id: true, orderNumber: true, createdAt: true, customerName: true, customerAddress: true, customerPhone: true, city: true, paymentMethod: true, paymentStatus: true, orderStatus: true, totalAmount: true, trackingNumber: true, orderItems: { select: { id: true, name: true, price: true, quantity: true, variant: true, productId: true } }, vendorShopOrders: { select: { status: true, shopOrderNumber: true, trackingNumber: true } }, services: { select: { id: true, quantity: true, price: true, status: true } } } });
  if (!order) throw new ApiError(404, "Order not found.");
  return { order: { ...order, totalAmount: Number(order.totalAmount), orderStatus: resolveCustomerOrderTrackStatus(order.orderStatus, order.vendorShopOrders), orderItems: order.orderItems.map(i => ({ ...i, price: Number(i.price) })), services: order.services.map(s => ({ ...s, price: Number(s.price) })), canCancel: canCustomerCancelOrder(order), hasDeliveredItems: order.orderStatus === "delivered" || order.vendorShopOrders.some(s => s.status === "delivered") } };
}); }