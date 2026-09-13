export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/serialize";

export async function GET() {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  const rows = await prisma.savedProduct.findMany({
    where: { customerId: auth.customer.id, product: { isActive: true } },
    orderBy: { createdAt: "desc" },
    include: { product: { select: catalogProductSelect() } },
  });
  return NextResponse.json({
    products: rows.map((row) => serializeProduct(row.product)),
  });
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
  const parsed = z.object({ productId: z.string().min(1).max(191) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, isActive: true },
    select: { id: true },
  });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  await prisma.savedProduct.upsert({
    where: {
      customerId_productId: {
        customerId: auth.customer.id,
        productId: product.id,
      },
    },
    create: { customerId: auth.customer.id, productId: product.id },
    update: {},
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
