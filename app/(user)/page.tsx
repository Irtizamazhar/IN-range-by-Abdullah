import Link from "@/components/ui/LoadingLink";

import Image from "next/image";

import { VendorSpotlight } from "@/components/user/MarketplaceHomePanels";

import type { Prisma } from "@prisma/client";

import { bestSellers } from "@/lib/best-sellers";



import { ArrowRight, Gift, Megaphone, ShoppingBag, Wrench } from "lucide-react";
import styles from "./HomePageHighlights.module.css";



import type { ProductCardData } from "@/components/user/ProductCard";

import { HomeAllProducts, HomeMarketplace, HomeTrendingWants } from "@/components/user/HomeMarketplace";



import { HeroSection } from "@/components/user/HeroSection";

import { HomePersonalization } from "@/components/user/HomePersonalization";
import { FirstCustomerWelcome } from "@/components/user/FirstCustomerWelcome";

import { VendorAuthProvider } from "@/context/VendorAuthContext";



import { CategoryAutoScroll } from "@/components/user/CategoryAutoScroll";

import { NewArrivalsSection } from "@/components/user/NewArrivalsSection";

import { ScrollToTopButton } from "@/components/user/ScrollToTopButton";



import { readActiveProductCategories } from "@/lib/categories-store";

import { loadMergedNewArrivalCards } from "@/lib/new-arrivals-catalog";

import { newArrivalsWindowStart } from "@/lib/product-new-arrival-window";

import { catalogProductSelect } from "@/lib/catalog-product-select";

import { prisma } from "@/lib/prisma";
import { actingIdentity, actorWhere, resolveWantViewer } from "@/lib/want-engagement";

import { serializeProduct } from "@/lib/serialize";

import { publicStores, topVendors } from "@/lib/store-service";

import { vendorReviewStatsService } from "@/lib/vendor-review-stats-service";

import { publicServices } from "@/lib/public-services";

import { giftProducts } from "@/lib/gift-products";



import {

  pickReviewStat,

  reviewStatsForProductIds,

} from "@/lib/review-stats";



export const dynamic = "force-dynamic";



const NEW_ARRIVALS_PAGE_SIZE = 6;

const BEST_SELLERS_PAGE_SIZE = 6;

const FEATURED_PAGE_SIZE = 8;

// Fade the left side of each photo into its banner background.
// Keeps the original images while removing their obvious rectangular edges.
const promoImageMask = {
  maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.12) 18%, rgba(0,0,0,0.65) 48%, black 72%)",
  WebkitMaskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.12) 18%, rgba(0,0,0,0.65) 48%, black 72%)",
} as const;



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



  // createdAt lets the card show a "New" tag; undated JSON items (epoch) get none.
  const initial = strip.map(

    ({

      createdAtTs,

      ...card

    }) => {

      return createdAtTs > 0 ? { ...card, createdAt: new Date(createdAtTs).toISOString() } : card;

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



  const categories = (await readActiveProductCategories()).filter((category) => category.showOnHome === true);

  const electronics = categories.find((category) => category.name.toLowerCase() === "electronics");



  const [wantExamples, topVendorRows, serviceExamples, giftExamples] = await Promise.all([

    prisma.want.findMany({

      where: {

        status: "OPEN",

        expiresAt: { gt: new Date() },

        customer: { isActive: true },

      },

      orderBy: { createdAt: "desc" },

      take: 8, // two rows of the 4-column Trending Wants grid

      select: {

        id: true,

        title: true,

        description: true,

        category: true,

        requestType: true,

        photo: true,

        createdAt: true,

        city: true,

        budgetMin: true,
        budgetMax: true,
        budgetFlexible: true,

        _count: { select: { offers: true, interests: true } },

        // Latest active joiners, shown as overlapping avatars on the Join Request button.
        interests: { where: { customer: { isActive: true } }, orderBy: { createdAt: "desc" }, take: 3, select: { customer: { select: { name: true, image: true } } } },

      },

    }),

    topVendors(4),

    publicServices({ take: 4 }),

    giftProducts({ take: 5 }),

  ]);

  // The heart on each Trending Want is the viewer's existing "Love" reaction.
  const wantActor = actingIdentity(await resolveWantViewer());
  const lovedWantIds = new Set(wantActor && wantExamples.length
    ? (await prisma.wantReaction.findMany({ where: { wantId: { in: wantExamples.map((want) => want.id) }, type: "LOVE", ...actorWhere(wantActor) }, select: { wantId: true } })).map((row) => row.wantId)
    : []);
  // Only an avatar image and first initial reach the client — never customer ids or full names.
  const trendingWants = wantExamples.map(({ interests, ...want }) => ({
    ...want,
    loved: lovedWantIds.has(want.id),
    joiners: interests.map(({ customer }) => ({
      image: customer.image || null,
      initial: (Array.from(customer.name.trim())[0] ?? "?").toUpperCase(),
    })),
  }));
  const sellerRows = topVendorRows.length ? topVendorRows.map(row => ({ vendor: row.vendor, label: row.label })) : (await publicStores()).slice(0, 4).map(vendor => ({ vendor, label: null }));

  const topVendorRatings = await vendorReviewStatsService(sellerRows.map((row) => row.vendor.id));

  const storeExamples = sellerRows.map((row) => ({

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

   * use the featured products.

   */

  const homepageProducts =

    bestSellers.initial.length > 0

      ? bestSellers.initial

      : featured;



  return (

    <>
      <FirstCustomerWelcome />

      {/* =====================================================

          HERO SECTION

      ====================================================== */}



      <HeroSection sellNowHref="/sell" />



      <main className="bg-brand-background">

        {/* =================================================

            SHOP BY CATEGORY

        ================================================= */}



        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-4 flex items-center justify-between gap-2 sm:gap-3">
            <h2 className="whitespace-nowrap text-[20px] font-black tracking-[-0.035em] text-brand-dark sm:text-[22px]">
              Shop by Category
            </h2>
            <Link
              href="/products"
              className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-white px-2.5 text-[12px] sm:px-3 font-bold text-brand-link shadow-xs transition hover:bg-brand-soft"
            >
              View All Categories
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {/* Handles its own empty state. */}
          <CategoryAutoScroll categories={categories} />
        </section>



        {/* Promotional collections — visual treatments only; destinations unchanged. */}
        <section
          aria-label="Explore JORO collections"
          className="mx-auto grid max-w-7xl gap-4 px-4 pb-7 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:gap-5"
        >
          {/* Electronics */}
          <article
            className={`${styles.promoCard} relative isolate min-h-[230px] overflow-hidden rounded-[22px] bg-gradient-to-r from-[#063b29] via-[#0b5137] to-[#75b735] text-white shadow-card sm:min-h-[230px]`}
          >
            <div
              aria-hidden="true"
              className={`${styles.promoVisual} pointer-events-none absolute inset-y-0 right-0 w-[67%] sm:w-[65%]`}
              style={promoImageMask}
            >
              <Image
                src="/branding/categories/category-electronics.png"
                alt=""
                fill
                sizes="(max-width: 639px) 67vw, (max-width: 1023px) 40vw, 25vw"
                className="object-cover object-center"
              />
            </div>
            <div className="relative z-10 flex min-h-[230px] w-[72%] flex-col items-start px-5 py-5 sm:w-[68%] sm:px-6 sm:py-6">
              <div>
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-lime-200">Shop smart</p>
                <h2 className="text-[21px] font-black leading-[1.12] tracking-tight sm:text-[23px]">
                  Discover Electronics
                </h2>
                <p className="mt-2 max-w-[210px] text-[12px] leading-[1.55] text-white/85">
                  Explore electronics and accessories.
                </p>
              </div>
              <Link
                href={electronics ? `/products?category=${encodeURIComponent(electronics.name)}` : "/products"}
                className={`${styles.promoButton} mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-[12px] font-black text-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
              >
                Shop Now <ArrowRight className={`${styles.promoArrow} h-4 w-4 shrink-0`} aria-hidden="true" />
              </Link>
            </div>
          </article>

          {/* Home services */}
          <article
            className={`${styles.promoCard} relative isolate min-h-[230px] overflow-hidden rounded-[22px] bg-[#f0eee8] text-brand-dark shadow-card sm:min-h-[230px]`}
          >
            <div
              aria-hidden="true"
              className={`${styles.promoVisual} pointer-events-none absolute inset-y-0 right-0 w-[67%] sm:w-[65%]`}
              style={promoImageMask}
            >
              <Image
                src="/branding/services/service-ac-repair.png"
                alt=""
                fill
                sizes="(max-width: 639px) 67vw, (max-width: 1023px) 40vw, 25vw"
                className="object-cover object-[center_46%]"
              />
            </div>
            <div className="relative z-10 flex min-h-[230px] w-[72%] flex-col items-start px-5 py-5 sm:w-[68%] sm:px-6 sm:py-6">
              <div>
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#327453]">Trusted expertise</p>
                <h2 className="text-[21px] font-black leading-[1.12] tracking-tight sm:text-[23px]">
                  Professional Home Services
                </h2>
                <p className="mt-2 max-w-[210px] text-[12px] leading-[1.55] text-brand-dark/75">
                  AC Repair, Cleaning, Plumbing &amp; More
                </p>
              </div>
              <Link
                href="/services"
                className={`${styles.promoButton} mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-[12px] font-black text-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark`}
              >
                Explore Services <ArrowRight className={`${styles.promoArrow} h-4 w-4 shrink-0`} aria-hidden="true" />
              </Link>
            </div>
          </article>

          {/* Gifts */}
          <article
            className={`${styles.promoCard} relative isolate min-h-[230px] overflow-hidden rounded-[22px] bg-[#fff0e2] text-[#602934] shadow-card sm:col-span-2 sm:min-h-[230px] lg:col-span-1`}
          >
            <div
              aria-hidden="true"
              className={`${styles.promoVisual} pointer-events-none absolute inset-y-0 right-0 w-[67%] sm:w-[65%]`}
              style={promoImageMask}
            >
              <Image
                src="/branding/categories/category-toys.png"
                alt=""
                fill
                sizes="(max-width: 639px) 67vw, (max-width: 1023px) 65vw, 25vw"
                className="object-cover object-center"
              />
            </div>
            <div className="relative z-10 flex min-h-[230px] w-[72%] flex-col items-start px-5 py-5 sm:w-[64%] sm:px-6 sm:py-6 lg:w-[68%]">
              <div>
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#97516a]">Thoughtful moments</p>
                <h2 className="text-[21px] font-black leading-[1.12] tracking-tight sm:text-[23px]">
                  Unique Gifts for Every Occasion
                </h2>
                <p className="mt-2 max-w-[210px] text-[12px] leading-[1.55] text-[#602934]/80">
                  Birthdays, Weddings &amp; More
                </p>
              </div>
              <Link
                href="/gifts"
                className={`${styles.promoButton} mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-[12px] font-black text-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-dark`}
              >
                Explore Gifts <ArrowRight className={`${styles.promoArrow} h-4 w-4 shrink-0`} aria-hidden="true" />
              </Link>
            </div>
          </article>
        </section>

        {/* Customer request callout — all text and buttons are real HTML elements. */}
        <section
          aria-label="Post your want"
          className="mx-auto max-w-7xl px-4 pb-9 sm:px-6"
        >
          <div
            className={`${styles.wantCard} relative isolate overflow-hidden rounded-[24px] border border-[#155f40] bg-gradient-to-r from-[#073b2a] via-[#0b5338] to-[#136c48] text-white shadow-panel`}
          >
            <div className={`${styles.wantGlow} pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#b7e33a]/10 blur-3xl`} aria-hidden="true" />
            <div className="pointer-events-none absolute right-[-60px] top-[-90px] h-[260px] w-[260px] rounded-full border border-white/10 sm:right-[120px]" aria-hidden="true" />
            <div className="pointer-events-none absolute right-[20px] top-[-50px] h-[200px] w-[200px] rounded-full border border-white/10 sm:right-[165px]" aria-hidden="true" />

            <div className="relative z-10 grid gap-5 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                <span
                  className={`${styles.wantIcon} inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-primary text-[#073b2a] shadow-[0_8px_22px_rgba(183,227,58,0.2)] sm:h-14 sm:w-14`}
                >
                  <Megaphone className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
                </span>

                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d0f36b] sm:text-[11px]">
                    Your need. Real offers.
                  </p>
                  <h2 className="mt-1.5 text-[23px] font-black leading-tight tracking-[-0.035em] sm:text-[27px]">
                    Can&apos;t find it? <span className="text-brand-primary">Post your want.</span>
                  </h2>
                  <p className="mt-2 max-w-[620px] text-[12px] leading-[1.6] text-white/80 sm:text-[13px]">
                    Need a product, service or custom gift? Post your request and connect with sellers.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-white/75">
                    <span className="inline-flex items-center gap-1.5"><ShoppingBag className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" /> Products</span>
                    <span className="inline-flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" /> Services</span>
                    <span className="inline-flex items-center gap-1.5"><Gift className="h-3.5 w-3.5 text-brand-primary" aria-hidden="true" /> Custom Gifts</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-stretch">
                <Link
                  href="/wants/new"
                  className={`${styles.wantPrimary} inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-brand-primary px-5 py-3 text-[13px] font-black text-[#073b2a] shadow-[0_10px_30px_rgba(0,0,0,0.15)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white`}
                >
                  Post Your Want
                  <ArrowRight className={`${styles.promoArrow} h-4 w-4 shrink-0`} aria-hidden="true" />
                </Link>
                <Link
                  href="/wants"
                  className={`${styles.wantSecondary} inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white`}
                >
                  Explore Requests
                  <ArrowRight className={`${styles.promoArrow} h-3.5 w-3.5`} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <VendorAuthProvider><HomePersonalization /></VendorAuthProvider>



        {/* =================================================

            MAIN MARKETPLACE AREA

        ================================================= */}



        <HomeTrendingWants wants={trendingWants} />

        {/* =================================================
            NEW ARRIVALS
        ================================================= */}

        <NewArrivalsSection
          initialProducts={newArrivals.initial}
          totalCount={newArrivals.total}
          pageSize={NEW_ARRIVALS_PAGE_SIZE}
        />

        <HomeMarketplace
          services={serviceExamples}
          gifts={giftExamples}
          stores={storeExamples}
        />

        <VendorSpotlight />

        {/* =================================================
            ALL PRODUCTS
        ================================================= */}

        <HomeAllProducts products={homepageProducts} />



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
