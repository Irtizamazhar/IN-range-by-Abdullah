import { Prisma } from "@prisma/client";
export async function notifyCustomer(tx: Prisma.TransactionClient, customerId: string, eventKey: string, title: string, href: string, message = title) {
  await tx.customerNotification.upsert({
    where: { idempotencyKey: eventKey },
    update: {},
    create: { customerId, idempotencyKey: eventKey, type: "marketplace", title, link: href, message },
  });
}
export async function notifyVendor(tx: Prisma.TransactionClient, vendorId: string, eventKey: string, title: string, href: string, message = title) {
  await tx.vendorNotification.createMany({ data: [{ vendorId, eventKey, title, href, message, type: "marketplace" }], skipDuplicates: true });
}