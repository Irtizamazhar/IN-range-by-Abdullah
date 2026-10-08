import { PostWantButton } from "@/components/user/PostWantButton";
import Link from "@/components/ui/LoadingLink";
import { VendorSpotlight } from "@/components/user/MarketplaceHomePanels";
import type { Prisma } from "@prisma/client";
import {bestSellers} from "@/lib/best-sellers";

import { ArrowRight, Megaphone } from "lucide-react";

import type { ProductCardData } from "@/components/user/ProductCard";
import { HomeMarketplace } from "@/components/user/HomeMarketplace";

import { HeroSection } from "@/components/user/HeroSection";

import { CategoryAutoScroll } from "@/components/user/CategoryAutoScroll";
import { NewArrivalsSection } from "@/components/user/NewArrivalsSection";
import { ScrollToTopButton } from "@/components/user/ScrollToTopButton";

import { readCategories } from "@/lib/categories-store";
import { loadMergedNewArrivalCards } from "@/lib/new-arrivals-catalog";
import { newArrivalsWindowStart } from "@/lib/product-new-arrival-window";
import { catalogProductSelect } from "@/lib/catalog-product-select";
import { prisma } from "@/lib/prisma";
import { serializeProduct } from "@/lib/serialize";
import { topVendors } from "@/lib/store-service";
import { vendorReviewStatsService } from "@/lib/vendor-review-stats-service";

import {
  pickReviewStat,
  reviewStatsForProductIds,
} from "@/lib/review-stats";

export const dynamic = "force-dynamic";

const NEW_ARRIVALS_PAGE_SIZE = 6;
const BEST_SELLERS_PAGE_SIZE = 6;
const FEATURED_PAGE_SIZE = 8;

/* =========================================================
   NEW ARRIVALS
========================================================= */

async function getNewArrivalsInitial(): Promise<{
  initial: ProductCardData[];
  total: number;
  stripPrismaIds: string[];
}> {
  const merged = await loadMergedNewArrivalCards({
    search: "",
    category: "",
  });

  const total = merged.length;

  const strip = merged.slice(
    0,
    NEW_ARRIVALS_PAGE_SIZE
  );

  const stripPrismaIds = strip
    .map((item) => String(item._id))
    .filter((id) => !id.startsWith("na-"));

  const initial = strip.map(
    ({
      createdAtTs,
      ...card
    }) => {
      void createdAtTs;

      return card;
    }
  );

  return {
    initial,
    total,
    stripPrismaIds,
  };
}

/* =========================================================
   BEST SELLERS

   Used for homepage picks.
========================================================= */

async function getBestSellersInitial(): Promise<{
  initial: ProductCardData[];
  total: number;
}> {
  try {
    const data = await bestSellers(0,BEST_SELLERS_PAGE_SIZE);
    const initial = data.products;

    return {
      initial,

      total:
        typeof data.total === "number"
          ? data.total
          : initial.length,
    };
  } catch (error) {
    console.error(
      "getBestSellersInitial:",
      error
    );

    return {
      initial: [],
      total: 0,
    };
  }
}

/* =========================================================
   FEATURED PRODUCTS
========================================================= */

async function getFeatured(
  excludePrismaIds: string[]
): Promise<ProductCardData[]> {
  try {
    const windowStart =
      newArrivalsWindowStart();

    const strict =
      await prisma.product.findMany({
        where: {
          isActive: true,

          createdAt: {
            lt: windowStart,
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        take:
          FEATURED_PAGE_SIZE,

        select:
          catalogProductSelect(),
      });

    let rows = strict;

    if (
      rows.length <
      FEATURED_PAGE_SIZE
    ) {
      const need =
        FEATURED_PAGE_SIZE -
        rows.length;

      const excludeIds = [
        ...strict.map(
          (product) => product.id
        ),

        ...excludePrismaIds,
      ];

      const where:
        Prisma.ProductWhereInput =
        {
          isActive: true,

          createdAt: {
            gte: windowStart,
          },
        };

      if (
        excludeIds.length > 0
      ) {
        where.id = {
          notIn: excludeIds,
        };
      }

      const filler =
        await prisma.product.findMany({
          where,

          orderBy: {
            createdAt: "desc",
          },

          take: need,

          select:
            catalogProductSelect(),
        });

      rows = [
        ...strict,
        ...filler,
      ];
    }

    const statsMap =
      await reviewStatsForProductIds(
        rows.map(
          (product) => product.id
        )
      );

    return rows.map(
      (product) => {
        const base =
          serializeProduct(product);

        const stat =
          pickReviewStat(
            statsMap,
            String(base._id)
          );

        return {
          ...base,

          reviewCount:
            stat.reviewCount,

          ratingAvg:
            stat.ratingAvg,
        } as ProductCardData;
      }
    );
  } catch (error) {
    console.error(
      "getFeatured:",
      error
    );

    return [];
  }
}

/* =========================================================
   HOME PAGE
========================================================= */

export default async function HomePage() {
  /* -------------------------------------------------------
     Load Categories
  ------------------------------------------------------- */

  const categories = (
    await readCategories()
  ).filter(
    (category) =>
      category.showOnHome === true
  );

  const [wantExamples, topVendorRows] = await Promise.all([
    prisma.want.findMany({
      where: {
        status: "OPEN",
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ offers: { _count: "desc" } }, { createdAt: "desc" }],
      take: 4,
      select: {
        id: true,
        title: true,
        city: true,
        _count: { select: { offers: true } },
      },
    }),
    topVendors(4),
  ]);
  const topVendorRatings = await vendorReviewStatsService(topVendorRows.map((row) => row.vendor.id));
  const storeExamples = topVendorRows.map((row) => ({
    id: row.vendor.id,
    shopName: row.vendor.shopName,
    storeSlug: row.vendor.storeSlug,
    primaryCategory: row.vendor.primaryCategory,
    label: row.label,
    rating: topVendorRatings.get(row.vendor.id) ?? { ratingAvg: 0, reviewCount: 0 },
  }));

  /* -------------------------------------------------------
     Load Product Data
  ------------------------------------------------------- */

  const bestSellers =
    await getBestSellersInitial();

  const newArrivals =
    await getNewArrivalsInitial();

  const featured =
    await getFeatured(
      newArrivals.stripPrismaIds
    );

  /*
   * Prefer Best Sellers.
   * If no bestseller data exists,
   * use Featured Products.
   */
  const homepageProducts =
    bestSellers.initial.length > 0
      ? bestSellers.initial
      : featured;

  return (
    <>
      {/* =====================================================
          HERO SECTION
      ====================================================== */}

      <HeroSection sellNowHref="/sell" />

      <main className="bg-brand-background">
        {/* =================================================
            POST YOUR WANT BAR
        ================================================= */}

        <section
          id="wants"
          className="mx-auto max-w-7xl px-4 pt-4 sm:px-6"
        >
          <div className="joro-v3-want rounded-[22px] border border-brand-primary/20 p-3.5 shadow-card sm:p-4">
            <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center">
              {/* LEFT */}

              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="joro-v3-want-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-primary text-brand-dark">
                  <Megaphone className="h-6 w-6" />
                </span>

                <div>
                  <p className="text-[12px] font-black uppercase tracking-[0.1em] text-brand-link">
                    Product nahi mila?
                  </p>

                  <h2 className="mt-0.5 text-[20px] font-black tracking-[-0.035em] text-brand-dark sm:text-[22px]">
                    Post Your Want
                  </h2>

                  <p className="mt-0.5 text-[12px] font-medium text-black/45">
                    Jo chahiye market ko batao.
                  </p>
                </div>
              </div>

              {/* RIGHT */}

              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <PostWantButton

                  className="flex h-11 flex-1 items-center rounded-xl border border-black/[0.07] bg-white/75 px-4 text-[12px] font-medium text-black/45 transition hover:border-brand-primary/50"
                >
                  e.g. Gaming laptop under 250k
                </PostWantButton>

                <Link
                  href="/wants"
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-[12px] font-black text-brand-dark transition hover:bg-brand-hover"
                >
                  Explore Wants

                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            SHOP BY CATEGORY
        ================================================= */}

        <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="mb-3.5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.1em] text-brand-link">
                Explore Marketplace
              </p>

              <h2 className="mt-0.5 text-[20px] font-black tracking-[-0.035em] text-brand-dark sm:text-[22px]">
                Shop by Category
              </h2>
            </div>

            <Link
              href="/products"
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-3 text-[12px] font-bold text-brand-link shadow-xs transition hover:bg-brand-soft"
            >
              View All

              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {categories.length > 0 ? (
            <CategoryAutoScroll
              categories={
                categories
              }
            />
          ) : (
            <div className="rounded-[18px] border border-black/[0.05] bg-white p-7 text-center text-[12px] font-medium text-black/40 shadow-xs">
              Categories will appear here.
            </div>
          )}
        </section>

        {/* =================================================
            MAIN MARKETPLACE AREA
        ================================================= */}

        <HomeMarketplace
          products={homepageProducts}
          wants={wantExamples}
          stores={storeExamples}
        />
        <VendorSpotlight />

        {/* =================================================
            NEW ARRIVALS
        ================================================= */}

        <NewArrivalsSection
          initialProducts={
            newArrivals.initial
          }
          totalCount={
            newArrivals.total
          }
          pageSize={
            NEW_ARRIVALS_PAGE_SIZE
          }
        />

        {/* =================================================
            FINAL BRAND CTA
        ================================================= */}

        <section
          id="together"
          className="mx-auto max-w-7xl px-4 pb-10 pt-2 sm:px-6"
        >
          <div className="relative overflow-hidden rounded-[22px] bg-[#123D27] px-5 py-6 text-white shadow-panel sm:px-7">
            {/* glow */}

            <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-brand-primary/10 blur-3xl" />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* TEXT */}

              <div>
                <p className="text-[12px] font-black uppercase tracking-[0.12em] text-brand-primary">
                  Shop Pakistani • Support Local • Grow Together
                </p>

                <h2 className="mt-1.5 text-[25px] font-black tracking-[-0.04em] sm:text-[30px]">
                  Pakistan ko{" "}
                  <span className="text-brand-primary">
                    JORO.
                  </span>
                </h2>

                <p className="mt-1.5 max-w-xl text-[12px] font-medium leading-5 text-white/55">
                  Customer ki need aur seller ka solution — aik marketplace.
                </p>
              </div>

              {/* CTA */}

              <Link
                href="/login?role=vendor&mode=signup"
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-[12px] font-black text-brand-dark transition hover:bg-brand-hover"
              >
                Seller Bano

                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <ScrollToTopButton />
    </>
  );
}
