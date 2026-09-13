export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string } };

export async function GET(_request: NextRequest, context: Ctx) {
  const session = await getCustomerSession();
  const customerId = session?.user?.role === "customer" ? session.user.id : undefined;
  const want = await prisma.wantPost.findUnique({
    where: { id: context.params.id },
    include: {
      _count: { select: { offers: true } },
      offers: customerId
        ? {
            where: { want: { customerId } },
            orderBy: { createdAt: "desc" },
            include: { vendor: { select: { id: true, shopName: true, city: true } } },
          }
        : false,
    },
  });
  if (!want || (want.status !== "open" && want.customerId !== customerId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    want: {
      ...want,
      budgetMin: want.budgetMin == null ? null : Number(want.budgetMin),
      budgetMax: want.budgetMax == null ? null : Number(want.budgetMax),
      offers: Array.isArray(want.offers)
        ? want.offers.map((offer) => ({ ...offer, amount: Number(offer.amount) }))
        : [],
      offerCount: want._count.offers,
      _count: undefined,
      isOwner: want.customerId === customerId,
      customerId: undefined,
    },
  });
}

export async function PATCH(req: NextRequest, context: Ctx) {
  const session = await getCustomerSession();
  if (session?.user?.role !== "customer" || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (body.action !== "close") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const result = await prisma.wantPost.updateMany({
    where: { id: context.params.id, customerId: session.user.id, status: { in: ["pending", "open"] } },
    data: { status: "closed" },
  });
  if (result.count !== 1) return NextResponse.json({ error: "Not found or already closed" }, { status: 404 });
  await prisma.wantOffer.updateMany({
    where: { wantId: context.params.id, status: "pending" },
    data: { status: "rejected" },
  });
  return NextResponse.json({ ok: true });
}
