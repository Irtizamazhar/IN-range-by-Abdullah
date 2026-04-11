export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { computeDiscountPercent } from "@/lib/product-discount";
import { serializeProduct } from "@/lib/serialize";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, context: Ctx) {
  const { id } = context.params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: catalogProductSelect(),
  });
  const admin = await isAdmin();
  if (!product || (!product.isActive && !admin)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(serializeProduct(product, { forAdmin: admin }));
}

async function isAdmin() {
  const session = await getAdminSession();
  return session?.user?.role === "admin";
}

export async function PUT(req: NextRequest, context: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = context.params;
  const body = await req.json();
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, price: true, originalPrice: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const price =
    body.price !== undefined ? Number(body.price) : Number(existing.price);
  const originalPrice =
    body.originalPrice !== undefined
      ? body.originalPrice != null
        ? Number(body.originalPrice)
        : null
      : existing.originalPrice != null
        ? Number(existing.originalPrice)
        : null;
  const discountPercent = computeDiscountPercent(price, originalPrice);

  const data: Prisma.ProductUpdateInput = {
    price,
    originalPrice: originalPrice ?? null,
    discountPercent,
  };
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.category !== undefined) data.category = body.category;
  if (body.stock !== undefined) data.stock = Number(body.stock);
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.variants !== undefined) data.variants = body.variants;

  let imageIds: string[] | undefined;
  if (body.imageIds !== undefined) {
    const ids = Array.isArray(body.imageIds)
      ? body.imageIds.map((x: unknown) => String(x))
      : [];
    const rows = await prisma.productImage.findMany({
      where: { id: { in: ids } },
    });
    if (rows.length !== ids.length) {
      return NextResponse.json({ error: "Invalid imageIds" }, { status: 400 });
    }
    for (const row of rows) {
      if (row.productId !== null && row.productId !== id) {
        return NextResponse.json({ error: "Invalid imageIds" }, { status: 400 });
      }
    }
    imageIds = ids;
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      if (imageIds !== undefined) {
        await tx.productImage.deleteMany({
          where: { productId: id, id: { notIn: imageIds } },
        });
        for (let i = 0; i < imageIds.length; i++) {
          await tx.productImage.update({
            where: { id: imageIds[i] },
            data: { productId: id, sortOrder: i },
          });
        }
      }

      return tx.product.update({
        where: { id },
        data,
        select: catalogProductSelect(),
      });
    });

    return NextResponse.json(serializeProduct(product, { forAdmin: true }));
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = context.params;
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
