export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { readProducts, writeProducts } from "@/lib/products-store";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isFinite(id) ? id : NaN;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const products = await readProducts();
  const row = products.find((p) => p.id === id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const products = await readProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const current = products[idx];
    const imageList =
      body.images !== undefined
        ? Array.isArray(body.images)
          ? body.images.map((x) => String(x || "").trim()).filter(Boolean)
          : []
        : Array.isArray((current as { images?: unknown }).images)
          ? ((current as { images?: unknown }).images as unknown[])
              .map((x) => String(x || "").trim())
              .filter(Boolean)
          : [];
    const imageFromBody = body.image !== undefined ? String(body.image).trim() : "";
    const primaryImage =
      imageList[0] || imageFromBody || String((current as { image?: unknown }).image || "").trim();
    const price = body.price !== undefined ? Number(body.price) : current.price;
    const stock =
      body.stock !== undefined
        ? Math.max(0, Number(body.stock))
        : Math.max(0, Number((current as { stock?: unknown }).stock ?? 0));
    const originalPrice =
      body.originalPrice !== undefined
        ? body.originalPrice === null || body.originalPrice === ""
          ? undefined
          : Number(body.originalPrice)
        : current.originalPrice;

    const descFromBody =
      body.description !== undefined ? String(body.description).trim() : undefined;
    const nextDescription =
      descFromBody !== undefined
        ? descFromBody || undefined
        : (current as { description?: string }).description;

    products[idx] = {
      ...current,
      name: body.name !== undefined ? String(body.name) : current.name,
      category: body.category !== undefined ? String(body.category) : current.category,
      image: primaryImage,
      images: imageList.length ? imageList : primaryImage ? [primaryImage] : [],
      price: Number.isFinite(price) ? price : current.price,
      originalPrice: Number.isFinite(Number(originalPrice)) ? Number(originalPrice) : undefined,
      isFeatured: body.isFeatured !== undefined ? body.isFeatured === true : current.isFeatured,
      stock,
      inStock: stock > 0,
      isNew: true,
      description: nextDescription,
    };

    await writeProducts(products);
    return NextResponse.json(products[idx]);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await ctx.params;
  const id = parseId(rawId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const products = await readProducts();
  const next = products.filter((p) => p.id !== id);
  if (next.length === products.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await writeProducts(next);
  return NextResponse.json({ ok: true });
}
