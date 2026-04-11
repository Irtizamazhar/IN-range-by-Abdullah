export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApprovedVendorApi } from "@/lib/vendor-api-auth";
import { vendorProductCreateSchema } from "@/lib/vendor-product-schemas";
import { sanitizePlainText, sanitizeDescriptionHtml } from "@/lib/security/sanitize";
import { prisma } from "@/lib/prisma";
import { syncVendorProductStorefront } from "@/lib/sync-vendor-product-storefront";

export async function GET() {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  const rows = await prisma.vendorProduct.findMany({
    where: { vendorId: auth.vendor.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    products: rows.map((p) => ({
      id: p.id,
      productName: p.productName,
      description: p.description,
      price: p.price.toString(),
      category: p.category,
      stock: p.stock,
      images: p.images,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApprovedVendorApi();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = vendorProductCreateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    const first = Object.values(msg).flat()[0] || "Validation failed";
    return NextResponse.json({ error: first, details: msg }, { status: 400 });
  }

  const d = parsed.data;
  const productName = sanitizePlainText(d.productName, 200);
  const description = sanitizeDescriptionHtml(d.description, 20_000);
  const category = sanitizePlainText(d.category, 100);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.vendorProduct.create({
        data: {
          vendorId: auth.vendor.id,
          productName,
          description,
          price: new Prisma.Decimal(d.price.toFixed(2)),
          category,
          stock: d.stock,
          images: d.images as unknown as Prisma.InputJsonValue,
          status: "active",
        },
      });
      await syncVendorProductStorefront(row.id, tx);
      return row;
    });
    return NextResponse.json({
      ok: true,
      product: {
        id: created.id,
        productName: created.productName,
        price: created.price.toString(),
      },
    });
  } catch (e) {
    console.error("vendor product create", e);
    return NextResponse.json(
      { error: "Could not create product or publish to storefront" },
      { status: 500 }
    );
  }
}
