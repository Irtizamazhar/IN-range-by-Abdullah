export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { orderId: string } };

export async function GET(_req: NextRequest, context: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = context.params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { paymentProofData: true, paymentProofMime: true },
  });
  if (!order?.paymentProofData) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(order.paymentProofData), {
    status: 200,
    headers: {
      "Content-Type": order.paymentProofMime || "image/jpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
