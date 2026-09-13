export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { addressSchema } from "@/lib/customer-address-schema";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";

export async function GET() {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  const addresses = await prisma.customerAddress.findMany({
    where: { customerId: auth.customer.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ addresses });
}

export async function POST(req: NextRequest) {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = addressSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the address fields" }, { status: 400 });

  const count = await prisma.customerAddress.count({ where: { customerId: auth.customer.id } });
  const isDefault = parsed.data.isDefault || count === 0;
  const address = await prisma.$transaction(
    async (tx) => {
      if (isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId: auth.customer.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.customerAddress.create({
        data: {
          customerId: auth.customer.id,
          label: sanitizePlainText(parsed.data.label, 60),
          recipientName: sanitizePlainText(parsed.data.recipientName, 200),
          phone: sanitizePlainText(parsed.data.phone, 40),
          address: sanitizePlainText(parsed.data.address, 2000),
          city: sanitizePlainText(parsed.data.city, 120),
          postalCode: parsed.data.postalCode
            ? sanitizePlainText(parsed.data.postalCode, 30)
            : null,
          isDefault,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  return NextResponse.json({ address }, { status: 201 });
}
