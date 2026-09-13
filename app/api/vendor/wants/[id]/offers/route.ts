export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { wantOfferSchema } from "@/lib/want-schema";
import { createCustomerNotification } from "@/lib/customer-notifications";

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, context: Ctx) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = wantOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Check your offer" }, { status: 400 });
  }
  const want = await prisma.wantPost.findFirst({
    where: {
      id: context.params.id,
      status: "open",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true, customerId: true, title: true },
  });
  if (!want) return NextResponse.json({ error: "Want is no longer open" }, { status: 409 });
  const existing = await prisma.wantOffer.findUnique({
    where: { wantId_vendorId: { wantId: want.id, vendorId: auth.vendor.id } },
  });
  if (existing && existing.status !== "pending") {
    return NextResponse.json({ error: "This offer can no longer be edited" }, { status: 409 });
  }
  const offer = await prisma.$transaction(async (tx) => {
    const row = await tx.wantOffer.upsert({
      where: { wantId_vendorId: { wantId: want.id, vendorId: auth.vendor.id } },
      create: {
        wantId: want.id,
        vendorId: auth.vendor.id,
        amount: new Prisma.Decimal(parsed.data.amount.toFixed(2)),
        message: sanitizePlainText(parsed.data.message, 2000),
        estimatedDays: parsed.data.estimatedDays ?? null,
      },
      update: {
        amount: new Prisma.Decimal(parsed.data.amount.toFixed(2)),
        message: sanitizePlainText(parsed.data.message, 2000),
        estimatedDays: parsed.data.estimatedDays ?? null,
      },
    });
    await createCustomerNotification({
      customerId: want.customerId,
      type: "want_offer",
      title: existing ? "A seller updated an offer" : "New offer on your Want",
      message: `${want.title}: Rs. ${parsed.data.amount.toLocaleString("en-PK")}`,
      link: `/wants/${want.id}`,
      idempotencyKey: `want-offer:${row.id}`,
    }, tx);
    return row;
  });
  return NextResponse.json({ ok: true, id: offer.id }, { status: existing ? 200 : 201 });
}
