export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/sessions";
import { requireAdminPermission } from "@/lib/admin-rbac";
import { prisma } from "@/lib/prisma";
import { computeDiscountPercent } from "@/lib/product-discount";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { serializeProduct } from "@/lib/serialize";
import { pickReviewStat, reviewStatsForProductIds } from "@/lib/review-stats";

function readPriceFilter(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : undefined;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "newest";
  const minPrice = readPriceFilter(searchParams.get("minPrice"));
  const maxPrice = readPriceFilter(searchParams.get("maxPrice"));
  const inStock = searchParams.get("inStock") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const adminList = searchParams.get("admin") === "1";
  const isAdmin = session?.user?.role === "admin";
  const maxLimit = adminList && isAdmin ? 500 : 48;
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get("limit") || "12", 10))
  );

  const where: Prisma.ProductWhereInput = {};
  if (!adminList || !isAdmin) {
    where.isActive = true;
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }
  if (category) {
    where.category = category;
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {
      ...(minPrice !== undefined ? { gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
    };
  }
  if (inStock) {
    where.stock = { gt: 0 };
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
  if (sort === "price_asc") orderBy = { price: "asc" };
  if (sort === "price_desc") orderBy = { price: "desc" };
  if (sort === "newest") orderBy = { createdAt: "desc" };

  const skip = (page - 1) * limit;
  const isAdminList = adminList && isAdmin;
  const [productRows, total, catalogPrices] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: catalogProductSelect(),
    }),
    prisma.product.count({ where }),
    // Keep the public slider bounds stable while users refine their results.
    isAdminList
      ? Promise.resolve(null)
      : prisma.product.aggregate({
          where: { isActive: true },
          _min: { price: true },
          _max: { price: true },
        }),
  ]);
  let products = productRows;
  if (isAdminList && products.length > 0) {
    const ids = products.map((p) => p.id);
    const flags = await prisma.$queryRaw<Array<{ id: string; b: unknown }>>(
      Prisma.sql`SELECT id, isBestSeller AS b FROM product WHERE id IN (${Prisma.join(ids)})`
    );
    const map = new Map(
      flags.map((r) => [r.id, Boolean(Number(r.b))] as const)
    );
    products = products.map((p) => ({
      ...p,
      isBestSeller: map.get(p.id) ?? false,
    }));
  }
  if (!isAdminList) {
    /**
     * Paginate the real `Product` table only. The previous implementation merged
     * one page of Prisma rows with *all* “new arrival” cards, re-sorted, and
     * re-sliced — so most products (including vendor-published rows) never
     * appeared on the correct pages. JSON `na-*` items stay on `/new-arrivals`
     * via `/api/products/new-arrivals`.
     */
    const ids = products.map((p) => p.id);
    const reviewMap = await reviewStatsForProductIds(ids);
    const list = products.map((p) => {
      const base = serializeProduct(p, { forAdmin: false });
      const stat = pickReviewStat(reviewMap, String(base._id));
      return {
        ...base,
        reviewCount: stat.reviewCount,
        ratingAvg: stat.ratingAvg,
      };
    });
    return NextResponse.json({
      products: list,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      priceRange: {
        min: Number(catalogPrices?._min.price ?? 0),
        max: Number(catalogPrices?._max.price ?? 0),
      },
    });
  }

  const adminIds = products.map((p) => p.id);
  const adminReviewMap = await reviewStatsForProductIds(adminIds);
  return NextResponse.json({
    products: products.map((p) => {
      const base = serializeProduct(p, { forAdmin: isAdminList });
      const stat = pickReviewStat(adminReviewMap, String(base._id));
      return { ...base, reviewCount: stat.reviewCount, ratingAvg: stat.ratingAvg };
    }),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminPermission("catalog.manage");
  if ("response" in auth) return auth.response;
  const body = await req.json();
  const price = Number(body.price);
  const originalPrice =
    body.originalPrice != null ? Number(body.originalPrice) : null;
  const discountPercent = computeDiscountPercent(price, originalPrice);

  const imageIds: string[] = Array.isArray(body.imageIds)
    ? body.imageIds.map((x: unknown) => String(x))
    : [];

  let product;
  try {
    product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: body.name,
        description: body.description ?? "",
        price,
        originalPrice: originalPrice ?? undefined,
        discountPercent,
        category: body.category,
        stock: Number(body.stock ?? 0),
        warrantyMonths:
          Number.isInteger(Number(body.warrantyMonths)) && Number(body.warrantyMonths) > 0
            ? Math.min(120, Number(body.warrantyMonths))
            : null,
        variants: body.variants ?? [],
        isActive: body.isActive ?? true,
      },
    });

    if (imageIds.length) {
      const rows = await tx.productImage.findMany({
        where: { id: { in: imageIds } },
      });
      if (rows.length !== imageIds.length) {
        throw new Error("Invalid imageIds");
      }
      for (const row of rows) {
        if (row.productId !== null) {
          throw new Error("Invalid imageIds");
        }
      }
      for (let i = 0; i < imageIds.length; i++) {
        await tx.productImage.update({
          where: { id: imageIds[i] },
          data: { productId: created.id, sortOrder: i },
        });
      }
    }

    return tx.product.findUniqueOrThrow({
      where: { id: created.id },
      include: { productImages: { orderBy: { sortOrder: "asc" } } },
    });
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    if (msg === "Invalid imageIds") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json(serializeProduct(product, { forAdmin: true }));
}
