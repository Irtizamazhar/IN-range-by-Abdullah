"use client";

import { preload } from "react-dom";
import { getImageProps } from "next/image";
import { heroBackground, heroBackgroundSizes } from "@/lib/hero-image";

/** Discover the same optimized responsive background before homepage data resolves. */
export function HomeHeroPreload() {
  const { props } = getImageProps({ src: heroBackground, alt: "", fill: true, sizes: heroBackgroundSizes, priority: true });
  preload(props.src, {
    as: "image",
    fetchPriority: "high",
    imageSrcSet: props.srcSet,
    imageSizes: props.sizes,
  });
  return null;
}
