export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { RETURN_INCLUDE, serializeCustomerReturn } from "@/lib/after-sales";
import { prisma } from "@/lib/prisma";

const trackingSchema = z.object({
  customerTracking: z.string().trim().min(3).max(191),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  const parsed = trackingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid return tracking reference is required" }, { status: 400 });
  }

  const gate = await prisma.returnRequest.updateMany({
    where: {
      id: params.id,
      customerId: auth.customer.id,
      status: "vendor_approved",
    },
    data: {
      status: "return_in_transit",
      customerTracking: parsed.data.customerTracking,
    },
  });
  if (gate.count !== 1) {
    return NextResponse.json(
      { error: "Return not found or it is not awaiting your shipment" },
      { status: 409 }
    );
  }
  const row = await prisma.returnRequest.findUniqueOrThrow({
    where: { id: params.id },
    include: RETURN_INCLUDE,
  });
  return NextResponse.json({ return: serializeCustomerReturn(row) });
}
