export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCustomerApi } from "@/lib/customer-api-auth";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { ORDER_INCLUDE_SERIALIZE } from "@/lib/prisma-order-includes";
import { prisma } from "@/lib/prisma";
import { serializeOrder, serializeProduct } from "@/lib/serialize";

export async function GET() {
  const auth = await requireCustomerApi();
  if ("response" in auth) return auth.response;
  const [profile, orders, addresses, saved, follows, wants] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: auth.customer.id },
      select: { id: true, name: true, email: true, phone: true, image: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { customerId: auth.customer.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: ORDER_INCLUDE_SERIALIZE,
    }),
    prisma.customerAddress.findMany({
      where: { customerId: auth.customer.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    prisma.savedProduct.findMany({
      where: { customerId: auth.customer.id, product: { isActive: true } },
      orderBy: { createdAt: "desc" },
      include: { product: { select: catalogProductSelect() } },
    }),
    prisma.storeFollow.findMany({
      where: { customerId: auth.customer.id, vendor: { status: "approved" } },
      orderBy: { createdAt: "desc" },
      include: {
        vendor: {
          select: {
            id: true,
            shopName: true,
            storeSlug: true,
            primaryCategory: true,
            city: true,
            _count: { select: { followers: true, products: true } },
          },
        },
      },
    }),
    prisma.want.findMany({
      where: { customerId: auth.customer.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { _count: { select: { offers: true } } },
    }),
  ]);
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    profile,
    orders: orders.map((order) => serializeOrder(order)),
    addresses,
    savedProducts: saved.map((row) => serializeProduct(row.product)),
    followedStores: follows.map((row) => row.vendor),
    wants: wants.map((want) => ({
      ...want,
      budgetMin: want.budgetMin == null ? null : Number(want.budgetMin),
      budgetMax: want.budgetMax == null ? null : Number(want.budgetMax),
      offerCount: want._count.offers,
      _count: undefined,
    })),
  });
}
