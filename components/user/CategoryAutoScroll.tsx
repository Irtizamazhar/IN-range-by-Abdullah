"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

type CategoryItem = {
  id: number;
  name: string;
  image: string;
};

export function CategoryAutoScroll({ categories }: { categories: CategoryItem[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const AUTO_SCROLL_MIN_ITEMS = 11;
  const autoScrollEnabled = categories.length >= AUTO_SCROLL_MIN_ITEMS;

  useEffect(() => {
    const el = ref.current;
    if (!el || !autoScrollEnabled) return;

    let rafId = 0;
    let lastTs = 0;
    const pixelsPerSecond = 40;

    const tick = (ts: number) => {
      if (!lastTs) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      if (maxScroll <= 1) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }

      const next = el.scrollLeft + pixelsPerSecond * dt;
      el.scrollLeft = next >= maxScroll ? 0 : next;

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [autoScrollEnabled]);

  return (
    <div
      ref={ref}
      className={`flex w-full gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        autoScrollEnabled ? "justify-start" : "justify-center"
      }`}
    >
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/products?category=${encodeURIComponent(category.name)}`}
          className="group shrink-0"
        >
          <div className="relative mx-auto h-[92px] w-[92px] overflow-hidden rounded-full shadow-md transition-transform duration-300 group-hover:scale-105 sm:h-[100px] sm:w-[100px]">
            <Image
              src={category.image}
              alt={category.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 92px, 100px"
              unoptimized={shouldUnoptimizeImageSrc(category.image)}
            />
          </div>
          <p className="mt-2 max-w-[100px] text-center text-xs font-bold leading-snug text-gray-900 sm:max-w-[108px] sm:text-sm">
            {category.name}
          </p>
        </Link>
      ))}
    </div>
  );
}
