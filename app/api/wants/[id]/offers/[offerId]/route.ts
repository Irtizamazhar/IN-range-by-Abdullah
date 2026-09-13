export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string; offerId: string } };

export async function PATCH(req: NextRequest, context: Ctx) {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (body.action !== "reject") {
    return NextResponse.json(
      { error: "Offer checkout is disabled until payment and return policies are configured." },
      { status: 409 }
    );
  }
  const offer = await prisma.wantOffer.findFirst({
    where: {
      id: context.params.offerId,
      wantId: context.params.id,
      want: { customerId: auth.customer.id },
      status: "pending",
    },
    select: { id: true },
  });
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.wantOffer.update({ where: { id: offer.id }, data: { status: "rejected" } });
  return NextResponse.json({ ok: true });
}
