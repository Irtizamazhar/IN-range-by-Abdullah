import { prisma } from "@/lib/prisma";
import { api, customerActor, sameOrigin } from "@/lib/marketplace-api";

export const dynamic = "force-dynamic";

export async function GET() {
  return api(async () => {
    const customer = await customerActor();
    const id = customer.id;
    const [wantCount, wants, joinedCount, joined, offerCount, ordersCount, welcome] = await Promise.all([
      prisma.want.count({ where: { customerId: id } }),
      prisma.want.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, title: true, status: true, expiresAt: true, _count: { select: { offers: true } } } }),
      prisma.wantInterest.count({ where: { customerId: id } }),
      prisma.wantInterest.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 3, select: { want: { select: { id: true, title: true, status: true, expiresAt: true } } } }),
      prisma.wantOffer.count({ where: { want: { customerId: id } } }),
      prisma.order.count({ where: { customerId: id } }),
      prisma.customerNotification.findFirst({ where: { customerId: id, type: "WELCOME_ONBOARDING", isRead: false }, select: { id: true } }),
    ]);
    return {
      customerId: id,
      name: customer.name,
      welcomeId: welcome?.id ?? null,
      counts: { wants: wantCount, joined: joinedCount, offers: offerCount, orders: ordersCount },
      wants: wants.map(want => ({ id: want.id, title: want.title, status: want.status, expiresAt: want.expiresAt, offers: want._count.offers })),
      joined: joined.map(row => row.want),
    };
  });
}

export async function PATCH(request: Request) {
  return api(async () => {
    sameOrigin(request);
    const customer = await customerActor();
    await prisma.customerNotification.updateMany({ where: { customerId: customer.id, type: "WELCOME_ONBOARDING", isRead: false }, data: { isRead: true } });
    return { ok: true };
  });
}
