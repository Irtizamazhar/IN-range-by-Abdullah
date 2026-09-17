import Image from "next/image";
import { LogoMark } from "@/components/user/LogoMark";

/** Extremely subtle Minar-e-Pakistan silhouette -- decorative line art, not a flag/poster element. */
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
      {/* Depth gradient + very low-opacity skyline */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#123d27] via-[#0c2618] to-[#081c12]" />
      <MinarSilhouette className="pointer-events-none absolute right-6 top-10 h-[70%] w-auto text-white/[0.05]" />
      <div className="pointer-events-none absolute -left-16 top-1/3 h-64 w-64 rounded-full bg-brand-primary/10 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col px-8 pt-6 xl:px-12 xl:pt-8">
        {/* Logo + tagline */}
        <div className="shrink-0">
          <LogoMark href={null} className="[&_img]:max-h-11 [&_img]:w-auto" />
          <p className="mt-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em]">
            <span className="joro-tagline-market-dark">Apni Market</span>
            <span className="joro-tagline-dot px-[3px]">•</span>
            <span className="joro-tagline-choice-dark">Apni Choice</span>
          </p>
        </div>

        {/* Headline */}
        <div className="mt-5 max-w-md shrink-0 xl:mt-6">
          <h1 className="text-[32px] font-black leading-[1.05] tracking-[-0.03em] text-white xl:text-[38px]">
            More Than Shopping
            <br />
            <span className="text-brand-primary">A Stronger Pakistan</span>
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-6 text-white/75">
            People, products and trusted vendors — together for a brighter, stronger Pakistan.
          </p>
        </div>

        {/* Benefits */}
        <div className="mt-4 grid shrink-0 grid-cols-4 gap-2 xl:mt-7 xl:gap-3">
          {BENEFITS.map((b) => (
            <div key={b.label} className="flex flex-col items-center gap-1.5 text-center">
              <Image src={b.icon} alt="" width={72} height={72} sizes="40px" className="h-9 w-9 object-contain xl:h-10 xl:w-10" />
              <p className="whitespace-pre-line text-[10px] font-bold leading-tight text-white/85 xl:text-[11px]">{b.label}</p>
            </div>
          ))}
        </div>

        {/* Marketplace artwork composition */}
        <div className="joro-auth-art relative mt-4 min-h-[180px] flex-1">
          <Image
            src="/branding/auth/auth-parcel-stack.png"
            alt=""
            width={1254}
            height={1254}
            sizes="420px"
            className="pointer-events-none absolute bottom-0 left-1/2 z-0 w-[62%] max-w-[420px] -translate-x-[38%] object-contain opacity-90 drop-shadow-[0_14px_20px_rgba(0,0,0,0.35)]"
          />
          <Image
            src="/branding/auth/auth-shopping-cart.png"
            alt="Shopping cart full of parcels"
            width={1254}
            height={1254}
            sizes="260px"
            className="pointer-events-none absolute bottom-0 left-0 z-10 w-[40%] max-w-[260px] object-contain drop-shadow-[0_16px_22px_rgba(0,0,0,0.4)]"
          />
          <Image
            src="/branding/auth/auth-mobile-marketplace.png"
            alt="JORO marketplace app on a phone"
            width={1254}
            height={1254}
            sizes="300px"
            className="pointer-events-none absolute bottom-0 left-1/2 z-20 w-[46%] max-w-[300px] -translate-x-1/2 object-contain drop-shadow-[0_18px_26px_rgba(0,0,0,0.45)]"
          />
          <Image
            src="/branding/auth/auth-shopping-bag.png"
            alt="JORO branded shopping bag"
            width={1254}
            height={1254}
            sizes="230px"
            className="pointer-events-none absolute bottom-0 right-0 z-10 w-[36%] max-w-[230px] object-contain drop-shadow-[0_16px_22px_rgba(0,0,0,0.4)]"
          />
        </div>
      </div>
    </div>
  );
}
