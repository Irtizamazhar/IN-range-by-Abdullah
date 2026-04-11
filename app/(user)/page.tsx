import LinkNext from "next/link";
import {
  ProductCard,
  ProductCardSkeleton,
  type ProductCardData,
} from "@/components/user/ProductCard";
import { HeroSection } from "@/components/user/HeroSection";
import { CategoryAutoScroll } from "@/components/user/CategoryAutoScroll";
import { BestSellersSection } from "@/components/user/BestSellersSection";
import { NewArrivalsSection } from "@/components/user/NewArrivalsSection";
import { ScrollToTopButton } from "@/components/user/ScrollToTopButton";
import { readCategories } from "@/lib/categories-store";
import { loadMergedNewArrivalCards } from "@/lib/new-arrivals-catalog";
import { newArrivalsWindowStart } from "@/lib/product-new-arrival-window";
import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/serialize";
import { pickReviewStat, reviewStatsForProductIds } from "@/lib/review-stats";
export const dynamic = "force-dynamic";

const NEW_ARRIVALS_PAGE_SIZE = 6;
const FEATURED_PAGE_SIZE = 8;

/** First page only; rest loaded via `/api/products/new-arrivals` when user clicks More. */
async function getNewArrivalsInitial(): Promise<{
  initial: ProductCardData[];
  total: number;
  /** Prisma product ids shown in the first New Arrivals strip (avoid duplicating them in Featured). */
  stripPrismaIds: string[];
}> {
  const merged = await loadMergedNewArrivalCards({ search: "", category: "" });
  const total = merged.length;
  const strip = merged.slice(0, NEW_ARRIVALS_PAGE_SIZE);
  const stripPrismaIds = strip
    .map((c) => String(c._id))
    .filter((id) => !id.startsWith("na-"));
  const initial = strip.map(({ createdAtTs, ...card }) => {
    void createdAtTs;
    return card;
  });
  return { initial, total, stripPrismaIds };
}

async function fetchBestSellersFromApi(): Promise<ProductCardData[]> {
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    const url = `${proto}://${host}/api/products/bestsellers`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error("Best Sellers API failed:", res.status, url);
      return [];
    }
    const data = (await res.json()) as { products?: ProductCardData[] };
    const bestSellers = data.products ?? [];
    return bestSellers;
  } catch (e) {
    console.error("fetchBestSellersFromApi", e);
    return [];
  }
}

/**
 * Prefer catalog products older than the 14-day “new” window (they “graduate” here).
 * If none exist yet (young store), backfill with other active products so the section is not empty,
 * excluding ids already shown in the first New Arrivals row.
 */
async function getFeatured(excludePrismaIds: string[]) {
  try {
    const windowStart = newArrivalsWindowStart();
    const strict = await prisma.product.findMany({
      where: {
        isActive: true,
        createdAt: { lt: windowStart },
      },
      orderBy: { createdAt: "desc" },
      take: FEATURED_PAGE_SIZE,
      select: catalogProductSelect(),
    });

    let rows = strict;
    if (rows.length < FEATURED_PAGE_SIZE) {
      const need = FEATURED_PAGE_SIZE - rows.length;
      const excludeIds = [...strict.map((p) => p.id), ...excludePrismaIds];
      const fillerWhere: Prisma.ProductWhereInput = {
        isActive: true,
        createdAt: { gte: windowStart },
      };
      if (excludeIds.length > 0) {
        fillerWhere.id = { notIn: excludeIds };
      }
      const filler = await prisma.product.findMany({
        where: fillerWhere,
        orderBy: { createdAt: "desc" },
        take: need,
        select: catalogProductSelect(),
      });
      rows = [...strict, ...filler];
    }

    const statsMap = await reviewStatsForProductIds(rows.map((p) => p.id));
    return rows.map((p) => {
      const base = serializeProduct(p);
      const stat = pickReviewStat(statsMap, String(base._id));
      return {
        ...base,
        reviewCount: stat.reviewCount,
        ratingAvg: stat.ratingAvg,
      };
    });
  } catch (e) {
    console.error("getFeatured", e);
    return [];
  }
}

export default async function HomePage() {
  const categories = (await readCategories()).filter((c) => c.showOnHome === true);
  const bestSellers = await fetchBestSellersFromApi();
  const newArrivals = await getNewArrivalsInitial();
  const featured = await getFeatured(newArrivals.stripPrismaIds);

  return (
    <>
      <HeroSection sellNowHref="/vendor/register" />

      <BestSellersSection products={bestSellers} />

      <section className="bg-[#F5F5F5] py-14">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-8 text-center text-3xl font-black text-gray-900">
            Shop by Category
          </h2>
          <CategoryAutoScroll categories={categories} />
        </div>
      </section>

      <NewArrivalsSection
        initialProducts={newArrivals.initial}
        totalCount={newArrivals.total}
        pageSize={NEW_ARRIVALS_PAGE_SIZE}
      />

      <section className="mx-auto max-w-7xl px-4 py-14 bg-lightGray/40">
        <h2 className="text-2xl font-bold text-darkText text-center mb-8">
          Featured Products
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {featured.length === 0
            ? Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))
            : featured.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
        </div>
        <div className="text-center mt-10">
          <LinkNext
            href="/products"
            className="inline-flex rounded-xl border-2 border-primaryBlue px-8 py-3 font-bold text-primaryBlue hover:bg-primaryBlue hover:text-white transition-colors"
          >
            View All Products
          </LinkNext>
        </div>
      </section>

      <ScrollToTopButton />
    </>
  );
}
