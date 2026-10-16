import Image from "next/image";
import parcelStack from "@/public/branding/auth/auth-parcel-stack.png";
import mobileMarketplace from "@/public/branding/auth/auth-mobile-marketplace.png";
import shoppingBag from "@/public/branding/auth/auth-shopping-bag.png";
import styles from "./AuthLayout.module.css";

/** Decorative artwork only; never intercepts form interactions. */
function MinarSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 500" className={className} fill="none" aria-hidden="true">
      <path
        d="M200 20 L206 60 L212 60 L212 120 L222 120 L222 220 L232 220 L232 340 L168 340 L168 220 L178 220 L178 120 L188 120 L188 60 L194 60 Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M110 340 Q110 300 150 290 L250 290 Q290 300 290 340 L290 400 L110 400 Z" stroke="currentColor" strokeWidth="2" />
      <path d="M70 400 L330 400 L330 430 L70 430 Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

const BENEFITS = [
  { icon: "/branding/auth/auth-trusted-vendor.png", label: "Trusted\nVendors" },
  { icon: "/branding/auth/auth-wide-selection.png", label: "Wide\nSelection" },
  { icon: "/branding/auth/auth-family-shopping.png", label: "Shop with\nFamily & Friends" },
  { icon: "/branding/auth/auth-secure-delivery.png", label: "Secure &\nReliable" },
] as const;

export function AuthBrandPanel({ className = "" }: { className?: string }) {
  return (
    <div className={`joro-auth-brand relative isolate overflow-hidden bg-[#0c2618] ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#123d27] via-[#0c2618] to-[#081c12]" />
      <MinarSilhouette className="pointer-events-none absolute right-6 top-10 h-[70%] w-auto text-white/[0.05]" />
      <div className="pointer-events-none absolute -left-16 top-1/3 h-64 w-64 rounded-full bg-brand-primary/10 blur-3xl" />

      <div className={`${styles.brandContent} relative z-10 flex h-full min-h-0 w-full flex-col px-6 pt-8 lg:px-8 xl:px-10 xl:pt-10`}>
        <div className={`${styles.brandIntro} shrink-0`}>
          <p className="mb-3 inline-flex rounded-full border border-lime-300/15 bg-lime-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white xl:text-[11px]">
            Pakistan&apos;s trusted marketplace 🇵🇰
          </p>
          <h1 className="text-[29px] font-black leading-[1.06] tracking-[-0.035em] text-white xl:text-[40px] 2xl:text-[46px]">
            More Than Shopping
            <br />
            <span className="text-brand-primary">A Stronger Pakistan</span>
          </h1>
          <p className="mt-3 max-w-lg text-[13px] leading-[1.55] text-white/85 xl:text-[15px]">
            People, products and trusted vendors — together for a brighter, stronger Pakistan.
          </p>
        </div>

        {/* Benefits are in normal document flow, outside the clipped artwork box. */}
        <div className={`${styles.brandBenefits} relative z-20 grid shrink-0 grid-cols-2 gap-x-3 gap-y-2 xl:gap-x-4`}>
          {BENEFITS.map((benefit) => (
            <div key={benefit.label} className="flex min-w-0 items-center gap-2 text-left">
              <Image
                src={benefit.icon}
                alt=""
                width={72}
                height={72}
                sizes="(min-width: 1280px) 40px, 34px"
                className="h-8 w-8 shrink-0 object-contain xl:h-10 xl:w-10"
              />
              <p className="min-w-0 whitespace-pre-line text-[11px] font-bold leading-[1.25] text-white/90 xl:text-xs">
                {benefit.label}
              </p>
            </div>
          ))}
        </div>

        {/* Images are constrained to this region and can never cover benefits. */}
        <div className={`${styles.brandArt} joro-auth-art relative mt-2 w-full min-h-0 flex-1`}>
          <Image
            src={parcelStack}
            alt=""
            sizes="(min-width: 1280px) 320px, 250px"
            className={`${styles.artImage} pointer-events-none absolute bottom-0 left-1/2 z-0 w-[65%] max-w-[390px] -translate-x-[38%] object-contain opacity-90 drop-shadow-[0_14px_20px_rgba(0,0,0,0.35)]`}
          />
          <Image
            src="/branding/auth/auth-shopping-cart.png"
            alt="Shopping cart full of parcels"
            width={1254}
            height={1254}
            sizes="(min-width: 1280px) 240px, 175px"
            className={`${styles.artImage} pointer-events-none absolute bottom-0 left-0 z-10 w-[40%] max-w-[240px] object-contain drop-shadow-[0_16px_22px_rgba(0,0,0,0.4)]`}
          />
          <Image
            src={mobileMarketplace}
            alt="JORO marketplace app on a phone"
            sizes="(min-width: 1280px) 270px, 200px"
            className={`${styles.artImage} pointer-events-none absolute bottom-0 left-1/2 z-20 w-[45%] max-w-[270px] -translate-x-1/2 object-contain drop-shadow-[0_18px_26px_rgba(0,0,0,0.45)]`}
          />
          <Image
            src={shoppingBag}
            alt="JORO branded shopping bag"
            sizes="(min-width: 1280px) 210px, 155px"
            className={`${styles.artImage} pointer-events-none absolute bottom-0 right-0 z-10 w-[36%] max-w-[210px] object-contain drop-shadow-[0_16px_22px_rgba(0,0,0,0.4)]`}
          />
        </div>
      </div>
    </div>
  );
}
