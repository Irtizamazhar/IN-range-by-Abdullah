export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/sessions";
import { prisma } from "@/lib/prisma";
import { computeDiscountPercent } from "@/lib/product-discount";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { serializeProduct } from "@/lib/serialize";
import { pickReviewStat, reviewStatsForProductIds } from "@/lib/review-stats";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "newest";
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

  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
  if (sort === "price_asc") orderBy = { price: "asc" };
  if (sort === "price_desc") orderBy = { price: "desc" };
  if (sort === "newest") orderBy = { createdAt: "desc" };

  const skip = (page - 1) * limit;
  const isAdminList = adminList && isAdmin;
  const [productRows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: catalogProductSelect(),
    }),
    prisma.product.count({ where }),
  ]);
  let products = productRows;
  if (isAdminList && products.length > 0) {
    const ids = products.map((p) => p.id);
    const flags = await prisma.$queryRaw<Array<{ id: string; b: unknown }>>(
      Prisma.sql`SELECT id, isBestSeller AS b FROM Product WHERE id IN (${Prisma.join(ids)})`
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
  const session = await getAdminSession();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
