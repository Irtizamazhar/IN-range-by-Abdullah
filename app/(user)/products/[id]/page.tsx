import { notFound } from "next/navigation";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/serialize";
import { ProductDetailClient } from "./ProductDetailClient";
import type { ProductCardData } from "@/components/user/ProductCard";
import {
  getProductReviewDashboard,
  pickReviewStat,
  reviewStatsForProductIds,
} from "@/lib/review-stats";

type PageProps = { params: { id: string } };

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      select: catalogProductSelect(),
    });
    if (!product || !product.isActive) notFound();

    const relatedRaw = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        category: product.category,
        isActive: true,
      },
      take: 4,
      select: catalogProductSelect(),
    });

    const relStats = await reviewStatsForProductIds(relatedRaw.map((r) => r.id));
    const related: ProductCardData[] = relatedRaw.map((r) => {
      const base = serializeProduct(r);
      return {
        ...base,
        ...pickReviewStat(relStats, String(base._id)),
      };
    });

    const dash = await getProductReviewDashboard(product.id);

    const p = serializeProduct(product);

    return (
      <ProductDetailClient
        product={{
          ...p,
          ratingAvg: dash.averageRating,
          reviewCount: dash.totalCount,
        }}
        related={related}
      />
    );
  } catch {
    notFound();
  }
}
