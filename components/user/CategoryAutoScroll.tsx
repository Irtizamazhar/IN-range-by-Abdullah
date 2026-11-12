"use client";

import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { useState } from "react";
import styles from "./CategoryAutoScroll.module.css";


import { shouldUnoptimizeCategoryImage } from "@/lib/public-category-image-policy";

type CategoryItem = {
  id: string | number;
  name: string;
  slug?: string;
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

/** The category's own image, else matching brand artwork, else null (a letter placeholder is shown). */
function categoryImage(category: CategoryItem) {
  if (category.image && !category.image.includes("default-category")) return category.image;
  const key = category.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return categoryArtwork[key] || null;
}

// Every item shares these exact sizes.
const item = "group flex w-[92px] shrink-0 snap-start flex-col items-center text-center outline-none sm:w-[96px]";
const circle = "relative flex h-[80px] w-[80px] items-center justify-center overflow-hidden rounded-full border-2 border-white ring-1 transition duration-200 group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5 sm:h-[76px] sm:w-[76px]";
const label = "mt-1.5 line-clamp-2 w-full break-normal text-xs leading-tight text-brand-dark [hyphens:none] [overflow-wrap:normal] sm:text-sm";
function CategoryCircle({ category, hidden = false }: { category: CategoryItem; hidden?: boolean }) {
  const src = categoryImage(category);
  // An image that cannot load (e.g. an external host the optimizer rejects, or a missing file) shows the initial instead.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <Link href={category.slug ? `/categories/${encodeURIComponent(category.slug)}` : `/products?category=${encodeURIComponent(category.name)}`} title={category.name} tabIndex={hidden ? -1 : undefined} className={item}>
    <span className={`${circle} bg-white ring-green-200 sm:bg-brand-soft group-hover:ring-green-500 group-focus-visible:ring-2 group-focus-visible:ring-green-600`}>
      {src && src !== failedSrc
        ? <Image src={src} alt="" fill sizes="(min-width: 640px) 76px, 80px" loading="lazy" unoptimized={shouldUnoptimizeCategoryImage(src)} onError={() => setFailedSrc(src)} className="object-contain sm:object-cover" />
        : <span aria-hidden="true" className="text-[24px] font-bold text-brand-dark/70 sm:text-[26px]">{category.name.trim().charAt(0).toUpperCase() || "?"}</span>}
    </span>
    <span className={label}>{category.name}</span>
  </Link>;
}

export function CategoryAutoScroll({ categories }: { categories: CategoryItem[] }) {
 return <div role="list" aria-label="Product categories" className={`${styles.row} flex w-full min-w-0 flex-nowrap gap-3 overflow-x-auto px-1 pb-3 pt-1`}>{categories.map(category => <div key={category.id} role="listitem" className="flex shrink-0"><CategoryCircle category={category} /></div>)}</div>;
}
