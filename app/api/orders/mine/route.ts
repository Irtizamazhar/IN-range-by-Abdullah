export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/sessions";
import { ORDER_INCLUDE_SERIALIZE } from "@/lib/prisma-order-includes";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serialize";

export async function GET() {
  const session = await getCustomerSession();
  if (session?.user?.role !== "customer" || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { customerId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: ORDER_INCLUDE_SERIALIZE,
  });

  return NextResponse.json({
    orders: orders.map((o) => serializeOrder(o)),
  });
}
