import { prisma } from "@/lib/prisma";
import { api, customerActor } from "@/lib/marketplace-api";
export const dynamic = "force-dynamic";
/** Lightweight unread count for the header bell; polled, so it never returns notification content. */
export async function GET() { return api(async () => {
  const customer = await customerActor();
  return { unread: await prisma.customerNotification.count({ where: { customerId: customer.id, isRead: false } }) };
}); }
