"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

type CategoryItem = {
  id: number;
  name: string;
  image: string;
};

export function CategoryAutoScroll({ categories }: { categories: CategoryItem[] }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || categories.length < 2) return;

    const timer = window.setInterval(() => {
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 1) {
        el.scrollLeft = 0;
        return;
      }
      el.scrollLeft += 1;
    }, 24);

    return () => window.clearInterval(timer);
  }, [categories.length]);

  return (
    <div
      ref={ref}
      className="flex w-full justify-center gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/products?category=${encodeURIComponent(category.name)}`}
          className="group shrink-0"
        >
          <div className="mx-auto h-[92px] w-[92px] overflow-hidden rounded-full shadow-md transition-transform duration-300 group-hover:scale-105 sm:h-[100px] sm:w-[100px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={category.image}
              alt={category.name}
              className="h-full w-full object-cover"
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
