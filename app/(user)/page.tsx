import Link from "next/link";
import { VendorSpotlight } from "@/components/user/MarketplaceHomePanels";
import type { Prisma } from "@prisma/client";
import {bestSellers} from "@/lib/best-sellers";

import {
  ArrowRight,
  Flame,
  MapPin,
  Megaphone,
  Sparkles,
  Store,
  TrendingUp,
} from "lucide-react";

import {
  ProductCard,
  ProductCardSkeleton,
  type ProductCardData,
} from "@/components/user/ProductCard";

import {
  HeroSection,
  type HeroProductPreview,
} from "@/components/user/HeroSection";

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

   Used for hero / homepage picks.
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
      take: 3,
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

  /* -------------------------------------------------------
     Products for Hero Floating Cards
  ------------------------------------------------------- */

  const heroProducts:
    HeroProductPreview[] =
    homepageProducts
      .slice(0, 3)
      .map((product) => ({
        name:
          product.name,

        price:
          product.price,

        image:
          product.images?.[0] ??
          null,

        href:
          product.href ||
          `/products/${product._id}`,

        discountPercent:
          product.discountPercent,
      }));

  return (
    <>
      {/* =====================================================
          HERO SECTION
      ====================================================== */}

      <HeroSection
        sellNowHref="/sell"
        heroProducts={
          heroProducts
        }
      />

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
                <Link
                  href="/wants/new"
                  className="flex h-11 flex-1 items-center rounded-xl border border-black/[0.07] bg-white/75 px-4 text-[12px] font-medium text-black/45 transition hover:border-brand-primary/50"
                >
                  e.g. Gaming laptop under 250k
                </Link>

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

        <section className="mx-auto max-w-7xl px-4 pb-7 sm:px-6">
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_285px_210px]">
            {/* =============================================
                FEATURED PRODUCTS
            ============================================== */}

            <div className="rounded-[22px] border border-black/[0.055] bg-white p-4 shadow-panel">
              {/* HEADER */}

              <div className="mb-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-soft text-brand-link">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>

                    <p className="text-[12px] font-black uppercase tracking-[0.1em] text-brand-link">
                      Popular Picks
                    </p>
                  </div>

                  <h2 className="mt-1.5 text-[20px] font-black tracking-[-0.035em] text-brand-dark">
                    Featured Products
                  </h2>
                </div>

                <Link
                  href="/products"
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-brand-background px-3 text-[12px] font-bold text-brand-link transition hover:bg-brand-soft"
                >
                  View All

                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* PRODUCT GRID */}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {homepageProducts.length ===
                0
                  ? Array.from({
                      length: 4,
                    }).map(
                      (_, index) => (
                        <ProductCardSkeleton
                          key={index}
                        />
                      )
                    )
                  : homepageProducts
                      .slice(0, 4)
                      .map(
                        (product) => (
                          <ProductCard
                            key={
                              product._id
                            }
                            product={
                              product
                            }
                          />
                        )
                      )}
              </div>
            </div>

            {/* =============================================
                TRENDING WANTS
            ============================================== */}

            <div
              id="trending-wants"
              className="rounded-[22px] border border-black/[0.055] bg-white p-4 shadow-panel"
            >
              {/* HEADER */}

              <div className="mb-3">
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-brand-link">
                  <TrendingUp className="h-3.5 w-3.5" />

                  What People Need
                </p>

                <h2 className="mt-1 flex items-center gap-1 text-[20px] font-black tracking-[-0.035em] text-brand-dark">
                  Trending Wants

                  <Flame className="h-4 w-4 fill-[#FF7900] text-[#FF7900]" />
                </h2>
              </div>

              {/* WANT CARDS */}

              <div className="space-y-2">
                {wantExamples.length ? wantExamples.map(
                  (want) => (
                    <Link
                      key={want.id}
                      href={`/wants/${want.id}`}
                      className="rounded-[14px] border border-black/[0.055] bg-[#FBFCF8] p-2.5 transition duration-200 hover:border-brand-primary/40 hover:bg-brand-soft/20"
                    >
                      <div className="flex items-start gap-2">
                        {/* ICON */}

                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-link">
                          <Flame className="h-3.5 w-3.5" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="line-clamp-2 text-[12px] font-bold leading-[17px] text-brand-dark">
                              {
                                want.title
                              }
                            </p>

                            <span className="shrink-0 rounded-full bg-brand-primary px-2 py-0.5 text-[9px] font-black text-brand-dark">
                              Open
                            </span>
                          </div>

                          {/* META */}

                          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-medium text-black/40">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" />

                              {
                                want.city
                              }
                            </span>

                            <span>
                              •
                            </span>

                            <span>
                              {
                                want._count.offers
                              }{" "}
                              offers
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                ) : (
                  <div className="rounded-[14px] border border-dashed border-black/[0.08] bg-[#FBFCF8] p-5 text-center text-[11px] font-semibold text-black/40">
                    No moderated Wants yet.
                  </div>
                )}
              </div>

              {/* CTA */}

              <Link
                href="/wants"
                className="mt-3 flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-brand-soft text-[11px] font-bold text-brand-link transition hover:bg-brand-primary hover:text-brand-dark"
              >
                Explore Wants

                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* =============================================
                TOP STORES
            ============================================== */}

            <div
              id="stores"
              className="rounded-[22px] bg-[#123D27] p-4 text-white shadow-panel"
            >
              {/* HEADER */}

              <div className="mb-3">
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-brand-primary">
                  <Store className="h-3.5 w-3.5" />

                  Seller Network
                </p>

                <h2 className="mt-1 text-[20px] font-black tracking-[-0.035em]">
                  Top Vendors
                </h2>

                <p className="mt-0.5 text-[10px] font-medium text-white/50">
                  Discover trusted stores selected on JORO
                </p>
              </div>

              {/* STORE LIST */}

              <div className="space-y-2">
                {storeExamples.length ? storeExamples.map(
                  (store) => (
                    <Link
                      key={store.id}
                      href={`/stores/${store.storeSlug || store.id}`}
                      className="flex items-center gap-2 rounded-[13px] border border-white/[0.08] bg-white/[0.055] p-2.5 transition duration-200 hover:border-brand-primary/30 hover:bg-white/[0.09]"
                    >
                      {/* STORE INITIALS */}

                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-[10px] font-black text-brand-dark">
                        {
                          store.shopName.slice(0, 2).toUpperCase()
                        }
                      </span>

                      {/* STORE INFO */}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-white">
                          {
                            store.shopName
                          }
                        </p>

                        <p className="mt-0.5 truncate text-[9px] font-medium text-white/50">
                          {store.primaryCategory}
                          {store.rating.reviewCount ? ` · ★ ${store.rating.ratingAvg.toFixed(1)} (${store.rating.reviewCount})` : " · No rating yet"}
                        </p>
                      </div>

                      {/* TOP VENDOR BADGE */}

                      <span className="shrink-0 rounded-full bg-brand-primary/15 px-1.5 py-0.5 text-[8px] font-black uppercase text-brand-primary">
                        {store.label || "Top Vendor"}
                      </span>
                    </Link>
                  )
                ) : (
                  <div className="rounded-[13px] border border-white/[0.08] p-4 text-center text-[10px] font-semibold text-white/50">
                    No Top Vendors selected yet.
                  </div>
                )}
              </div>

              {/* SELLER CTA */}

              <Link
                href="/stores"
                className="mt-3 flex h-9 items-center justify-center gap-1 rounded-lg bg-brand-primary text-[11px] font-black text-brand-dark transition hover:bg-brand-hover"
              >
                Browse Stores

                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>
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
