export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/sessions";
import { ORDER_INCLUDE_SERIALIZE } from "@/lib/prisma-order-includes";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serialize";

export async function GET() {
  const session = await getCustomerSession();
  if (session?.user?.role !== "customer" || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = String(session.user.email).trim();

  const orders = await prisma.order.findMany({
    where: { customerEmail: email },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: ORDER_INCLUDE_SERIALIZE,
  });

  return NextResponse.json({
    orders: orders.map((o) => serializeOrder(o)),
  });
}

