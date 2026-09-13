export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { getCustomerSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";

type Ctx = { params: { id: string } };

export async function GET(_request: Request, context: Ctx) {
  const session = await getCustomerSession();
  const customerId = session?.user?.role === "customer" ? session.user.id : undefined;
  const [vendor, followers, following] = await Promise.all([
    prisma.vendor.findFirst({ where: { id: context.params.id, status: "approved" }, select: { id: true } }),
    prisma.storeFollow.count({ where: { vendorId: context.params.id } }),
    customerId
      ? prisma.storeFollow.count({ where: { vendorId: context.params.id, customerId } })
      : Promise.resolve(0),
  ]);
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ followers, following: following > 0 });
}

export async function POST(_request: Request, context: Ctx) {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  const vendor = await prisma.vendor.findFirst({
    where: { id: context.params.id, status: "approved" },
    select: { id: true },
  });
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.storeFollow.upsert({
    where: { customerId_vendorId: { customerId: auth.customer.id, vendorId: vendor.id } },
    create: { customerId: auth.customer.id, vendorId: vendor.id },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  await prisma.storeFollow.deleteMany({
    where: { customerId: auth.customer.id, vendorId: context.params.id },
  });
  return NextResponse.json({ ok: true });
}
