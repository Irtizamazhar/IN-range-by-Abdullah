"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

type CategoryItem = {
  id: number;
  name: string;
  image: string;
};

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
          className="group w-[100px] shrink-0 sm:w-[112px]"
        >
          <div className="rounded-[18px] border border-black/[0.055] bg-white p-2.5 text-center shadow-[0_4px_16px_rgba(17,17,17,.035)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-brand-primary/45 group-hover:shadow-[0_12px_28px_rgba(17,17,17,.08)]">
            <div className="relative mx-auto h-[62px] w-full overflow-hidden rounded-[13px] bg-brand-background">
              <Image
                src={category.image}
                alt={category.name}
                fill
                sizes="112px"
                unoptimized={shouldUnoptimizeImageSrc(
                  category.image
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
    </div>
  );
}
