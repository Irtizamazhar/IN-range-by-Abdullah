export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/sessions";
import { nextProductId, readProducts, writeProducts } from "@/lib/products-store";

export async function GET() {
  try {
    const products = await readProducts();
    return NextResponse.json({ products });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load products" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const name = String(body.name || "").trim();
    const category = String(body.category || "").trim();
    const imageList = Array.isArray(body.images)
      ? body.images.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const image = imageList[0] || String(body.image || "").trim();
    const price = Number(body.price);
    const stock = Math.max(0, Number(body.stock ?? 0));
    const originalPrice =
      body.originalPrice === undefined || body.originalPrice === null || body.originalPrice === ""
        ? undefined
        : Number(body.originalPrice);
    const description = String(body.description ?? "").trim();

    if (!name || !category || !image || !Number.isFinite(price)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const products = await readProducts();
    const next = {
      id: nextProductId(products),
      name,
      price,
      originalPrice: Number.isFinite(originalPrice) ? originalPrice : undefined,
      category,
      image,
      images: imageList.length ? imageList : image ? [image] : [],
      ...(description ? { description } : {}),
      isNew: true,
      stock,
      inStock: stock > 0,
      isFeatured: body.isFeatured === true,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const updated = [next, ...products];
    await writeProducts(updated);
    return NextResponse.json(next, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add product" },
      { status: 500 }
    );
  }
}
