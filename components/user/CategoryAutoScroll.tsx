"use client";

import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { useEffect, useRef } from "react";
import { MoreHorizontal } from "lucide-react";

import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

type CategoryItem = {
  id: string | number;
  name: string;
  image: string;
};

const categoryArtwork: Record<string, string> = {
  electronics: "/branding/categories/category-electronics.png",
  "home-living": "/branding/categories/category-home-living.png",
  fashion: "/branding/categories/category-fashion.png",
  "health-beauty": "/branding/categories/category-beauty.png",
  "kitchen-dining": "/branding/categories/category-kitchen.png",
  "toys-kids-baby": "/branding/categories/category-toys.png",
  "sports-fitness": "/branding/categories/category-sports.png",
  automotive: "/branding/categories/category-automotive.png",
};

export function categoryImage(category: CategoryItem) {
  if (category.image && !category.image.includes("default-category")) return category.image;
  const key = category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return categoryArtwork[key] || category.image || "/branding/categories/category-home-living.png";
}

export function CategoryAutoScroll({
  categories,
}: {
  categories: CategoryItem[];
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const AUTO_SCROLL_MIN_ITEMS = 10;
  const autoScrollEnabled =
    categories.length >= AUTO_SCROLL_MIN_ITEMS;

  useEffect(() => {
    const scrollContainer = scrollRef.current;

    if (!scrollContainer || !autoScrollEnabled) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    let animationFrameId = 0;
    let previousTimestamp = 0;

    const pixelsPerSecond = 24;

    const tick = (timestamp: number) => {
      if (previousTimestamp === 0) {
        previousTimestamp = timestamp;
      }

      const deltaSeconds =
        (timestamp - previousTimestamp) / 1000;

      previousTimestamp = timestamp;

      const maxScrollLeft = Math.max(
        0,
        scrollContainer.scrollWidth -
          scrollContainer.clientWidth
      );

      if (maxScrollLeft > 1) {
        const nextScrollLeft =
          scrollContainer.scrollLeft +
          pixelsPerSecond * deltaSeconds;

        if (nextScrollLeft >= maxScrollLeft) {
          scrollContainer.scrollLeft = 0;
        } else {
          scrollContainer.scrollLeft =
            nextScrollLeft;
        }
      }

      animationFrameId =
        window.requestAnimationFrame(tick);
    };

    animationFrameId =
      window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(
        animationFrameId
      );
    };
  }, [autoScrollEnabled]);

  if (categories.length === 0) {
    return (
      <div className="flex min-h-[120px] w-full items-center justify-center rounded-[18px] border border-dashed border-black/10 bg-white">
        <p className="text-[13px] font-semibold text-black/40">
          No categories available.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="hide-scrollbar flex w-full gap-2.5 overflow-x-auto pb-2"
    >
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/products?category=${encodeURIComponent(
            category.name
          )}`}
          className="group w-[112px] shrink-0 sm:w-[132px] xl:min-w-0 xl:flex-1"
        >
          <div className="rounded-[18px] border border-black/[0.055] bg-white p-2.5 text-center shadow-[0_4px_16px_rgba(17,17,17,.035)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-brand-primary/45 group-hover:shadow-[0_12px_28px_rgba(17,17,17,.08)]">
            <div className="relative mx-auto h-[88px] w-full overflow-hidden rounded-[13px] bg-brand-background sm:h-[105px]">
              <Image
                src={categoryImage(category)}
                alt={category.name}
                fill
                sizes="112px"
                unoptimized={shouldUnoptimizeImageSrc(
                  categoryImage(category)
                )}
                className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            <p className="mt-2 line-clamp-2 min-h-[34px] text-center text-[12px] font-bold leading-[17px] text-brand-dark sm:text-[13px]">
              {category.name}
            </p>
          </div>
        </Link>
      ))}
      <Link href="/products" className="group w-[112px] shrink-0 sm:w-[132px] xl:min-w-0 xl:flex-1" aria-label="View all categories">
        <div className="rounded-[18px] border border-black/[0.055] bg-white p-2.5 text-center shadow-[0_4px_16px_rgba(17,17,17,.035)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_12px_28px_rgba(17,17,17,.08)]">
          <div className="mx-auto flex h-[88px] items-center justify-center rounded-[13px] bg-brand-background sm:h-[105px]"><MoreHorizontal className="h-10 w-10 text-brand-dark" aria-hidden="true" /></div>
          <p className="mt-2 min-h-[34px] text-[12px] font-bold leading-[17px] text-brand-dark sm:text-[13px]">More</p>
        </div>
      </Link>
    </div>
  );
}
