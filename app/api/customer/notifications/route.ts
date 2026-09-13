export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  const [rows, unread] = await Promise.all([
    prisma.customerNotification.findMany({
      where: { customerId: auth.customer.id },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
    prisma.customerNotification.count({
      where: { customerId: auth.customer.id, isRead: false },
    }),
  ]);
  return NextResponse.json({
    unread,
    notifications: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
  });
}

export async function PATCH() {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  await prisma.customerNotification.updateMany({
    where: { customerId: auth.customer.id, isRead: false },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true });
}
