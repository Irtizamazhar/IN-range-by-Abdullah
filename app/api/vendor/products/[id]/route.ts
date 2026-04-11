export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { vendorProductUpdateSchema } from "@/lib/vendor-product-schemas";
import { sanitizePlainText, sanitizeDescriptionHtml } from "@/lib/security/sanitize";
import { prisma } from "@/lib/prisma";
import {
  deleteVendorProductAndStorefront,
  syncVendorProductStorefront,
} from "@/lib/sync-vendor-product-storefront";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const p = await prisma.vendorProduct.findFirst({
    where: { id: ctx.params.id, vendorId: auth.vendor.id },
  });
  if (!p) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    product: {
      id: p.id,
      productName: p.productName,
      description: p.description,
      price: p.price.toString(),
      originalPrice:
        p.originalPrice != null ? p.originalPrice.toString() : null,
      category: p.category,
      stock: p.stock,
      images: p.images,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const existing = await prisma.vendorProduct.findFirst({
    where: { id: ctx.params.id, vendorId: auth.vendor.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = vendorProductUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    const first = Object.values(msg).flat()[0] || "Validation failed";
    return NextResponse.json({ error: first, details: msg }, { status: 400 });
  }

  const d = parsed.data;
  const data: Prisma.VendorProductUpdateInput = {};

  if (d.productName != null) {
    data.productName = sanitizePlainText(d.productName, 200);
  }
  if (d.description != null) {
    data.description = sanitizeDescriptionHtml(d.description, 20_000);
  }
  if (d.price != null) {
    data.price = new Prisma.Decimal(d.price.toFixed(2));
  }
  if (d.originalPrice !== undefined) {
    data.originalPrice =
      d.originalPrice === null
        ? null
        : new Prisma.Decimal(d.originalPrice.toFixed(2));
  }
  if (d.category != null) {
    data.category = sanitizePlainText(d.category, 255);
  }
  if (d.stock != null) {
    data.stock = d.stock;
  }
  if (d.images != null) {
    data.images = d.images as unknown as Prisma.InputJsonValue;
  }
  if (d.status != null) {
    data.status = d.status;
  }

  try {
    await prisma.vendorProduct.update({
      where: { id: existing.id },
      data,
    });
    try {
      await syncVendorProductStorefront(existing.id);
    } catch (e) {
      console.error("sync storefront after vendor update", e);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("vendor product patch", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const existing = await prisma.vendorProduct.findFirst({
    where: { id: ctx.params.id, vendorId: auth.vendor.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteVendorProductAndStorefront(existing.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("vendor product delete", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
