import { PostWantButton } from "@/components/user/PostWantButton";
import Link from "@/components/ui/LoadingLink";
import { HeroHeadline } from "./HeroHeadline";
import {
  ArrowRight,
  Megaphone,
  Play,
  ShoppingBag,
  Store,
} from "lucide-react";

export function HeroSection({
  sellNowHref,
}: {
  sellNowHref: string;
}) {
  return (
    <section className="joro-v4-hero relative isolate overflow-hidden text-white">
      {/* Background effects */}
      <div className="joro-v4-grid pointer-events-none absolute inset-0" />
      <div className="joro-v4-glow pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid min-h-[400px] max-w-7xl items-center gap-5 px-4 pb-6 pt-3 sm:px-6 lg:grid-cols-[0.92fr_1.08fr]">
        {/* =====================================================
            LEFT CONTENT
        ====================================================== */}

        <div className="relative z-20 self-start">
          {/* Small top badge */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-brand-primary backdrop-blur-md sm:text-[12px]">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary shadow-[0_0_12px_rgba(183,227,58,.9)]" />

            Pakistan ka apna marketplace
          </div>

          {/* Main heading */}
          <HeroHeadline />

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

            <PostWantButton

              className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-[13px] font-black text-brand-dark shadow-lime transition duration-300 hover:-translate-y-0.5 hover:bg-brand-hover"
            >
              <Megaphone className="h-4 w-4" />

              Want Post Karo

              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </PostWantButton>

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
        </div>
      </div>
    </section>
  );
}
