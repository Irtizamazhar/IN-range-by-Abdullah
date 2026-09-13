export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  const gate = await prisma.customerNotification.updateMany({
    where: { id: params.id, customerId: auth.customer.id },
    data: { isRead: true },
  });
  if (gate.count !== 1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
