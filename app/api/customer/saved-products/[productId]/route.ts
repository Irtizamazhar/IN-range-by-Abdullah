export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { productId: string } };

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  await prisma.savedProduct.deleteMany({
    where: { customerId: auth.customer.id, productId: context.params.productId },
  });
  return NextResponse.json({ ok: true });
}
