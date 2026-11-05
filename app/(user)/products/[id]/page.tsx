import { pageMetadata, productSchema, breadcrumbs } from "@/lib/seo";
import { seoProduct, indexableProductWhere } from "@/lib/seo-data";
import { JsonLd } from "@/components/seo/JsonLd";
import { notFound } from "next/navigation";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/serialize";
import { readPublicSettings } from "@/lib/settings-db";
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

export async function generateMetadata({ params }: PageProps) {
  const product = await seoProduct(params.id);
  if (!product) notFound();
  const item = serializeProduct(product);
  return pageMetadata(product.name, product.description || `Explore ${product.name} in ${product.category} on JORO.PK. View actual pricing and availability.`, `/products/${encodeURIComponent(product.id)}`, item.images[0]);
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = params;

  {
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
        vendor: { select: { id: true, shopName: true, storeSlug: true, shopLogo: true, status: true, lastLoginAt: true } },
      },
    });
    if (publication && (publication.status !== "active" || publication.vendor.status !== "approved")) notFound();
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
        isActive: true, AND: [indexableProductWhere],
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
      const settings = await readPublicSettings();
      delivery = { fee: Number(settings.codCharges ?? 0), codCities: settings.codAvailableCities ?? [] };
    } catch {
      delivery = null;
    }

    const p = serializeProduct(product);
    const category = await prisma.category.findFirst({ where: { name: product.category, isActive: true, products: { some: indexableProductWhere } }, select: { name: true, slug: true } });
    const crumbs = [{ name: "Home", path: "/" }, { name: "Products", path: "/products" }, ...(category ? [{ name: category.name, path: `/categories/${encodeURIComponent(category.slug)}` }] : []), { name: product.name, path: `/products/${encodeURIComponent(product.id)}` }];
    const schema = productSchema({ ...p, id: product.id }, sellerListed ? { name: publication.vendor.shopName, path: `/stores/${encodeURIComponent(publication.vendor.storeSlug || publication.vendor.id)}` } : null);

    return (
      <><JsonLd data={schema} /><JsonLd data={breadcrumbs(crumbs)} /><ProductDetailClient
        categoryHref={category ? `/categories/${encodeURIComponent(category.slug)}` : undefined}
        product={{
          ...p,
          ratingAvg: dash.averageRating,
          reviewCount: dash.totalCount,
        }}
        related={related}
        seller={seller}
        delivery={delivery}
        soldCount={sellerListed ? publication.totalSold : null}
      /></>
    );
  }
}
