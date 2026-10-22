
import Image from "next/image";
import { PostWantButton } from "@/components/user/PostWantButton";
import Link from "@/components/ui/LoadingLink";
import { HeroHeadline } from "./HeroHeadline";
import styles from "./HeroSection.module.css";
import {
  ArrowRight,
  Megaphone,
  ShoppingBag,
  Store,
} from "lucide-react";

export function HeroSection({
  sellNowHref,
}: {
  sellNowHref: string;
}) {
  return (
    <section className={`${styles.section} relative isolate overflow-hidden`}>
      <div className={`${styles.card} joro-v4-hero relative isolate mx-auto max-w-7xl overflow-hidden text-white`}>
      <div className="joro-v4-grid pointer-events-none absolute inset-0" />
      <div className="joro-v4-glow pointer-events-none absolute inset-0" />

      <div className={`${styles.layout} relative mx-auto grid min-h-[400px] items-center gap-4 px-4 pb-5 pt-5 sm:px-6 lg:grid-cols-[0.92fr_1.08fr]`}>

        {/* LEFT CONTENT — UNCHANGED */}
        <div className={`${styles.copy} relative z-20 self-start`}>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-brand-primary backdrop-blur-md sm:text-[12px]">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary shadow-[0_0_12px_rgba(183,227,58,.9)]" />
            Pakistan ka apna marketplace
          </div>

          <HeroHeadline />

          <h2 className={`${styles.subheading} mt-2 text-[24px] font-black leading-tight tracking-[-0.045em] text-white sm:text-[29px]`}>
            Na Mile?{" "}
            <span className="text-brand-primary">
              Request a Want
            </span>
          </h2>

          <p className={`${styles.description} mt-3 max-w-[520px] text-[14px] font-medium leading-6 text-white/75 sm:text-[15px] sm:leading-6`}>
            Products dekho, seller se connect ho aur asaani se order karo.
          </p>

          <div className={`${styles.actions} mt-5 flex flex-wrap gap-2.5`}>
            <Link
              href="/products"
              className={`${styles.primaryAction} group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-[13px] font-black text-brand-dark shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-xl`}
            >
              <ShoppingBag className="h-4 w-4" />
              Shop Karo
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            <PostWantButton
              className={`${styles.secondaryAction} group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/40 bg-transparent px-5 text-[13px] font-black text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/10`}
            >
              <Megaphone className="h-4 w-4" />
              Request a Want
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </PostWantButton>

            <Link
              href={sellNowHref}
              className={`${styles.tertiaryAction} group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/[0.06] px-5 text-[13px] font-black text-white backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-brand-primary/50 hover:bg-white/[0.1]`}
            >
              <Store className="h-4 w-4" />
              Seller Bano
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

        </div>

        {/* RIGHT VISUAL — JORO CONNECT IMAGE */}
        <div className={`${styles.visual} relative mx-auto flex h-[220px] w-full max-w-[680px] items-center justify-center sm:h-[300px] lg:h-[350px]`}>

          <div
            className="pointer-events-none absolute inset-x-[8%] top-[14%] h-[70%] rounded-full bg-emerald-400/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 w-full overflow-hidden rounded-[18px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
            <Image
              src="/branding/hero/men.png"
              alt="JORO Wants marketplace: customer requests, joining a request, vendor offers and private offers"
              width={1200}
              height={600}
              sizes="(max-width: 639px) 100vw, (max-width: 1023px) 90vw, 52vw"
              className="block h-auto w-full object-contain"
              priority
            />
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
