import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type NotificationDb = Prisma.TransactionClient | typeof prisma;

export async function createCustomerNotification(
  data: {
    customerId: string;
    type: string;
    title: string;
    message: string;
    link?: string | null;
    idempotencyKey: string;
  },
  db: NotificationDb = prisma
) {
  return db.customerNotification.upsert({
    where: { idempotencyKey: data.idempotencyKey },
    update: {},
    create: {
      customerId: data.customerId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link || null,
      idempotencyKey: data.idempotencyKey,
    },
  });
}
