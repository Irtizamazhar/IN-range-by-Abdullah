import { prisma } from "@/lib/prisma";
import { api, customerActor } from "@/lib/marketplace-api";
import { customerSavedProducts } from "@/lib/customer-saved-products";
import { addressSelect } from "@/lib/customer-address-service";
import { canCustomerCancelOrder } from "@/lib/customer-account-policy";
import { resolveCustomerOrderTrackStatus } from "@/lib/order-track-status";
import { hasLocalPassword } from "@/lib/customer-password-security";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return api(async () => {
  const c = await customerActor(); const q = new URL(request.url).searchParams; const page = Math.max(1, Math.min(100000, Number.parseInt(q.get("page") || "1",10) || 1)); const pageSize = 20;
  const [profile, orders, addresses, savedProducts, follows, wants, orderCount, wantCount, offerCount, unreadCount, returnCount, serviceCount] = await Promise.all([
    prisma.customer.findUnique({ where: { id: c.id }, select: { name: true, email: true, phone: true, image: true, createdAt: true, passwordHash: true } }),
    prisma.order.findMany({ where: { customerId: c.id }, select: { id: true, orderNumber: true, orderStatus: true, paymentStatus: true, totalAmount: true, createdAt: true, orderItems: { select: { id: true, name: true, quantity: true } }, vendorShopOrders: { select: { status: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: pageSize, skip: (page-1)*pageSize }),
    prisma.customerAddress.findMany({ where: { customerId: c.id }, select: addressSelect, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
    customerSavedProducts(c.id),
    prisma.storeFollow.findMany({ where: { customerId: c.id }, select: { vendor: { select: { id: true, shopName: true, shopLogo: true, storeSlug: true, primaryCategory: true, city: true, status: true, _count: { select: { followers: true } } } } }, orderBy: { createdAt: "desc" } }),
    prisma.want.findMany({ where: { customerId: c.id }, select: { id: true, title: true, status: true, category: true, city: true, quantity: true, budgetMin: true, budgetMax: true, budgetFlexible: true, moderationReason: true, createdAt: true, expiresAt: true, _count: { select: { offers: true, interests: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: pageSize, skip: (page-1)*pageSize }),
    prisma.order.count({ where: { customerId: c.id } }), prisma.want.count({ where: { customerId: c.id } }), prisma.wantOffer.count({ where: { want: { customerId: c.id } } }),
    prisma.customerNotification.count({ where: { customerId: c.id, isRead: false } }), prisma.returnRequest.count({ where: { customerId: c.id } }), prisma.orderService.count({ where: { order: { customerId: c.id } } }),
  ]);
  return { profile: profile && { name: profile.name, email: profile.email, phone: profile.phone, image: profile.image, createdAt: profile.createdAt, hasLocalPassword: hasLocalPassword(profile.passwordHash) }, orders: orders.map(o => ({ id: o.id, orderNumber: o.orderNumber, orderStatus: resolveCustomerOrderTrackStatus(o.orderStatus, o.vendorShopOrders), paymentStatus: o.paymentStatus, totalAmount: Number(o.totalAmount), createdAt: o.createdAt, items: o.orderItems, canCancel: canCustomerCancelOrder(o), hasDeliveredItems: o.orderStatus === "delivered" || o.vendorShopOrders.some(s => s.status === "delivered") })), addresses, savedProducts, followedStores: follows.map(f => f.vendor), wants: wants.map(w => ({ id: w.id, title: w.title, status: w.status, category: w.category, city: w.city, quantity: w.quantity, budgetMin: w.budgetMin == null ? null : Number(w.budgetMin), budgetMax: w.budgetMax == null ? null : Number(w.budgetMax), budgetFlexible: w.budgetFlexible, moderationReason: w.moderationReason, createdAt: w.createdAt, expiresAt: w.expiresAt, offerCount: w._count.offers, interestCount: w._count.interests })), counts: { orders: orderCount, wants: wantCount, offers: offerCount, saved: savedProducts.length, following: follows.length, unread: unreadCount, returns: returnCount, services: serviceCount }, pagination: { page, pageSize, orderPages: Math.ceil(orderCount/pageSize), wantPages: Math.ceil(wantCount/pageSize) } };
}); }