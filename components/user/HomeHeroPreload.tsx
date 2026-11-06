"use client";

import { preload } from "react-dom";

/** Keep this URL identical to .joro-v4-hero's CSS background (no transformed variant). */
export function HomeHeroPreload() {
  preload("/branding/hero/joro-premium-hero-bg.png", {
    as: "image",
    fetchPriority: "high",
  });
  return null;
}
