export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { addressSchema } from "@/lib/customer-address-schema";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/security/sanitize";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, context: Ctx) {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = addressSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the address fields" }, { status: 400 });
  const current = await prisma.customerAddress.findFirst({
    where: { id: context.params.id, customerId: auth.customer.id },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const address = await prisma.$transaction(
    async (tx) => {
      if (parsed.data.isDefault === true) {
        await tx.customerAddress.updateMany({
          where: { customerId: auth.customer.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      const data = parsed.data;
      return tx.customerAddress.update({
        where: { id: current.id },
        data: {
          ...(data.label !== undefined ? { label: sanitizePlainText(data.label, 60) } : {}),
          ...(data.recipientName !== undefined
            ? { recipientName: sanitizePlainText(data.recipientName, 200) }
            : {}),
          ...(data.phone !== undefined ? { phone: sanitizePlainText(data.phone, 40) } : {}),
          ...(data.address !== undefined ? { address: sanitizePlainText(data.address, 2000) } : {}),
          ...(data.city !== undefined ? { city: sanitizePlainText(data.city, 120) } : {}),
          ...(data.postalCode !== undefined
            ? { postalCode: data.postalCode ? sanitizePlainText(data.postalCode, 30) : null }
            : {}),
          ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  return NextResponse.json({ address });
}

export async function DELETE(_req: NextRequest, context: Ctx) {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  const current = await prisma.customerAddress.findFirst({
    where: { id: context.params.id, customerId: auth.customer.id },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.customerAddress.delete({ where: { id: current.id } });
  if (current.isDefault) {
    const replacement = await prisma.customerAddress.findFirst({
      where: { customerId: auth.customer.id },
      orderBy: { createdAt: "desc" },
    });
    if (replacement) {
      await prisma.customerAddress.update({ where: { id: replacement.id }, data: { isDefault: true } });
    }
  }
  return NextResponse.json({ ok: true });
}
