import { notFound } from "next/navigation";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/serialize";
import { getOrCreateSettings } from "@/lib/settings-db";
import { ProductDetailClient, type ProductDeliveryInfo } from "./ProductDetailClient";
import type { ProductCardData } from "@/components/user/ProductCard";
import {
  getProductReviewDashboard,
  pickReviewStat,
  reviewStatsForProductIds,
} from "@/lib/review-stats";

type PageProps = { params: { id: string } };

/** Seller activity from their last dashboard sign-in; computed here so server and client HTML match. */
function sellerActivityLabel(lastLoginAt: Date | null, now = Date.now()): string | null {
  if (!lastLoginAt) return null;
  const hours = Math.floor((now - lastLoginAt.getTime()) / 3_600_000);
  if (hours < 1) return "Active within the last hour";
  if (hours < 24) return `Active ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Active ${days} ${days === 1 ? "day" : "days"} ago`;
  return "Active over a month ago";
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      select: catalogProductSelect(),
    });
    if (!product || !product.isActive) notFound();
    const publication = await prisma.vendorProduct.findUnique({
      where: { publishedProductId: product.id },
      select: {
        status: true,
        totalSold: true,
        vendor: { select: { shopName: true, storeSlug: true, shopLogo: true, status: true, lastLoginAt: true } },
      },
    });
    const sellerListed = publication?.status === "active" && publication.vendor.status === "approved";
    const seller = sellerListed
      ? {
          name: publication.vendor.shopName,
          storeSlug: publication.vendor.storeSlug,
          logo: publication.vendor.shopLogo,
          activity: sellerActivityLabel(publication.vendor.lastLoginAt),
        }
      : null;

    const relatedRaw = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        OR: product.categoryRecordId
          ? [{ categoryRecordId: product.categoryRecordId }, { category: product.category }]
          : [{ category: product.category }],
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

    // Checkout charges the shop-wide delivery fee; show the same figure here.
    let delivery: ProductDeliveryInfo | null = null;
    try {
      const settings = await getOrCreateSettings();
      delivery = { fee: Number(settings.codCharges ?? 0), codCities: settings.codAvailableCities ?? [] };
    } catch {
      delivery = null;
    }

    const p = serializeProduct(product);

    return (
      <ProductDetailClient
        product={{
          ...p,
          ratingAvg: dash.averageRating,
          reviewCount: dash.totalCount,
        }}
        related={related}
        seller={seller}
        delivery={delivery}
        soldCount={sellerListed ? publication.totalSold : null}
      />
    );
  } catch {
    notFound();
  }
}
