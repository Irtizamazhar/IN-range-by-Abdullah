export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { serializeProduct } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const limitRaw = parseInt(req.nextUrl.searchParams.get("limit") || "6", 10);
  const limit = Math.min(20, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 6));

  if (q.length < 2) {
    return NextResponse.json({ products: [] });
  }

  try {
    const rows = await prisma.product.findMany({
      where: {
        isActive: true,
        name: { contains: q },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: catalogProductSelect({ take: 1 }),
    });

    const products = rows.map((p) => {
      const s = serializeProduct(p, { forAdmin: false });
      return {
        id: s.id,
        name: s.name,
        category: s.category,
        price: s.price,
        image: s.images[0] || null,
      };
    });

    return NextResponse.json({ products });
  } catch (e) {
    console.error("GET /api/products/search", e);
    return NextResponse.json(
      { products: [], error: "Search failed" },
      { status: 500 }
    );
  }
}
