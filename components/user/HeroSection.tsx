import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Megaphone,
  Play,
  ShoppingBag,
  Store,
} from "lucide-react";

import { formatPKR } from "@/lib/format";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

export type HeroProductPreview = {
  name: string;
  price: number;
  image?: string | null;
  href: string;
  discountPercent?: number;
};

export function HeroSection({
  sellNowHref,
  heroProducts = [],
}: {
  sellNowHref: string;
  heroProducts?: HeroProductPreview[];
}) {
  /*
   * Hero par sirf woh products show honge
   * jin ke paas actual image ho.
   */
  const cards = heroProducts
    .filter((product) => Boolean(product.image))
    .slice(0, 3);

  return (
    <section className="joro-v4-hero relative isolate overflow-hidden text-white">
      {/* Background effects */}
      <div className="joro-v4-grid pointer-events-none absolute inset-0" />
      <div className="joro-v4-glow pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid min-h-[400px] max-w-7xl items-center gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:py-6">
        {/* =====================================================
            LEFT CONTENT
        ====================================================== */}

        <div className="relative z-20">
          {/* Small top badge */}
          <div className="mt-3 mb-4 inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-brand-primary backdrop-blur-md sm:mt-4 sm:text-[12px] lg:mt-5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary shadow-[0_0_12px_rgba(183,227,58,.9)]" />

            Pakistan ka apna marketplace
          </div>

          {/* Main heading */}
          <h1 className="max-w-[620px] text-[38px] font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-[48px] lg:text-[55px]">
            Jo chahiye,
            <br />

            <span className="text-brand-primary">
              JORO
            </span>{" "}
            par dhoondo.
          </h1>

          {/* Want headline */}
          <h2 className="mt-2 text-[24px] font-black leading-tight tracking-[-0.045em] text-white sm:text-[29px]">
            Na mile?{" "}
            <span className="text-brand-primary">
              Want post karo.
            </span>
          </h2>

          {/* Description */}
          <p className="mt-3 max-w-[520px] text-[14px] font-medium leading-6 text-white/75 sm:text-[15px] sm:leading-6">
            Products dekho, seller se connect ho aur asaani se order karo.
          </p>

          {/* Buttons */}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link
              href="/products"
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-[13px] font-black text-brand-dark shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
            >
              <ShoppingBag className="h-4 w-4" />

              Shop Karo

              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            <Link
              href="/wants/new"
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-[13px] font-black text-brand-dark shadow-lime transition duration-300 hover:-translate-y-0.5 hover:bg-brand-hover"
            >
              <Megaphone className="h-4 w-4" />

              Want Post Karo

              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            <Link
              href={sellNowHref}
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/[0.06] px-5 text-[13px] font-black text-white backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-brand-primary/50 hover:bg-white/[0.1]"
            >
              <Store className="h-4 w-4" />

              Seller Bano

              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Compact trust row */}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-white/55 sm:text-[12px]">
            <span>✓ Verified Sellers</span>
            <span>✓ Secure Shopping</span>
            <span>✓ Pakistan Delivery</span>
          </div>
        </div>

        {/* =====================================================
            RIGHT VISUAL
        ====================================================== */}

        <div className="relative mx-auto h-[300px] w-full max-w-[650px] sm:h-[325px] lg:h-[350px]">
          {/* Decorative network ring */}
          <div className="joro-v4-ring absolute left-[52%] top-[48%] h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 sm:h-[310px] sm:w-[310px] lg:h-[330px] lg:w-[330px]" />

          {/* =================================================
              LAPTOP POSITION WRAPPER
              IMPORTANT:
              This wrapper handles translate/position only.
          ================================================== */}

          <div className="absolute left-[52%] top-[47%] z-20 w-[70%] max-w-[445px] -translate-x-1/2 -translate-y-1/2 sm:w-[72%] lg:left-[53%] lg:top-[47%] lg:w-[76%]">
            {/* Animation happens ONLY here */}
            <div className="joro-v4-laptop-motion">
              <div className="joro-v4-laptop-screen">
                <video
                  src="/videos/mixkit-delivering-a-package-to-a-woman-at-home-42130-full-hd.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover object-center"
                />

                {/* Video shade */}
                <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-black/15 via-transparent to-black/10" />

                {/* Top JORO badge */}
                <div className="absolute left-3 top-3 z-10 rounded-lg border border-white/10 bg-black/65 px-2.5 py-1.5 backdrop-blur-md">
                  <span className="text-[8px] font-black text-brand-primary">
                    JORO.pk
                  </span>
                </div>

                {/* Video bottom badge */}
                <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-black/70 px-3 py-2 backdrop-blur-md">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-brand-dark">
                    <Play className="h-3 w-3 fill-current" />
                  </span>

                  <div>
                    <p className="text-[8px] font-black text-white">
                      JORO Marketplace
                    </p>

                    <p className="text-[7px] text-white/60">
                      Shop • Want • Connect
                    </p>
                  </div>
                </div>
              </div>

              {/* Laptop base */}
              <div className="joro-v4-laptop-base" />
            </div>
          </div>

          {/* =================================================
              FLOATING PRODUCT 1
          ================================================== */}

          {cards[0] ? (
            <Link
              href={cards[0].href}
              className="joro-v4-product joro-v4-product-one absolute left-[1%] top-[6%] z-30 hidden w-[98px] rounded-2xl bg-white p-2 text-brand-dark xl:block"
            >
              <HeroProductCard product={cards[0]} />
            </Link>
          ) : null}

          {/* =================================================
              FLOATING PRODUCT 2
          ================================================== */}

          {cards[1] ? (
            <Link
              href={cards[1].href}
              className="joro-v4-product joro-v4-product-two absolute bottom-[6%] left-[4%] z-30 hidden w-[98px] rounded-2xl bg-white p-2 text-brand-dark xl:block"
            >
              <HeroProductCard product={cards[1]} />
            </Link>
          ) : null}

          {/* =================================================
              FLOATING PRODUCT 3
          ================================================== */}

          {cards[2] ? (
            <Link
              href={cards[2].href}
              className="joro-v4-product joro-v4-product-three absolute right-[0%] top-[9%] z-30 hidden w-[98px] rounded-2xl bg-white p-2 text-brand-dark xl:block"
            >
              <HeroProductCard product={cards[2]} />
            </Link>
          ) : null}

          {/* =================================================
              JORO MESSAGE
          ================================================== */}

          <div className="joro-v4-message absolute bottom-[4%] right-[0%] z-30 hidden rounded-2xl border border-brand-primary/30 bg-[#0d2517]/95 px-3.5 py-3 shadow-xl backdrop-blur-md xl:block">
            <p className="text-[7px] font-black uppercase tracking-[0.12em] text-brand-primary">
              JORO Together
            </p>

            <p className="mt-1 max-w-[110px] text-[7px] leading-3.5 text-white/60">
              Customer ki need.
              <br />
              Seller ka solution.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   HERO PRODUCT CARD
========================================================= */

function HeroProductCard({
  product,
}: {
  product: HeroProductPreview;
}) {
  return (
    <>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-brand-background">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="98px"
            unoptimized={shouldUnoptimizeImageSrc(product.image)}
            className="object-contain p-1"
          />
        ) : null}

        {product.discountPercent &&
        product.discountPercent > 0 ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-primary px-1.5 py-0.5 text-[6px] font-black text-brand-dark">
            -{product.discountPercent}%
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 line-clamp-1 text-[7px] font-bold text-brand-dark">
        {product.name}
      </p>

      <p className="mt-0.5 text-[8px] font-black text-brand-dark">
        {formatPKR(product.price)}
      </p>
    </>
  );
}
