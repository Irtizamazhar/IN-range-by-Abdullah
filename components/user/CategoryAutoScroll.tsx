"use client";

import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";

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
const row = "hide-scrollbar flex snap-x snap-proximity overflow-x-auto scroll-px-1 px-1 pb-1 pt-1";
const PIXELS_PER_SECOND = 30;
const RESUME_AFTER_TOUCH_MS = 2500;

/** Uploaded category images go through the optimizer (small WebP instead of the full original); other unoptimizable sources stay direct. */
function optimizable(src: string) {
  return src.startsWith("/uploads/categories/") || !shouldUnoptimizeImageSrc(src);
}

function CategoryCircle({ category, hidden = false }: { category: CategoryItem; hidden?: boolean }) {
  const src = categoryImage(category);
  // If the optimizer cannot read a file (e.g. one uploaded after the build), fall back to the original once.
  const [direct, setDirect] = useState(false);
  return <Link href={`/products?category=${encodeURIComponent(category.name)}`} title={category.name} tabIndex={hidden ? -1 : undefined} className={item}>
    <span className={`${circle} bg-white ring-green-200 sm:bg-brand-soft group-hover:ring-green-500 group-focus-visible:ring-2 group-focus-visible:ring-green-600`}>
      {src
        ? <Image src={src} alt="" fill sizes="(min-width: 640px) 76px, 80px" loading="lazy" unoptimized={direct || !optimizable(src)} onError={() => { if (!direct && optimizable(src)) setDirect(true); }} className="object-contain sm:object-cover" />
        : <span aria-hidden="true" className="text-[24px] font-bold text-brand-dark/70 sm:text-[26px]">{category.name.trim().charAt(0).toUpperCase() || "?"}</span>}
    </span>
    <span className={label}>{category.name}</span>
  </Link>;
}

/**
 * Home "Shop by Category": one row of round category images (Daraz/Amazon style). When the circles do not
 * fit, the row drifts right-to-left in an endless loop (over a duplicated list) and pauses on hover, focus
 * and touch. Swipe and trackpad work natively; mouse wheel and click-drag are mapped here. Few categories
 * or prefers-reduced-motion leave it as a still, scrollable row.
 */
export function CategoryAutoScroll({ categories }: { categories: CategoryItem[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const firstList = useRef<HTMLDivElement>(null);
  const secondList = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });
  const [reducedMotion, setReducedMotion] = useState(false);
  const pause = useRef({ hover: false, focus: false, dragging: false, until: 0 });
  const looping = overflowing && !reducedMotion;
  const holdFor = (ms: number) => { pause.current.until = performance.now() + ms; };

  function scrollCategories(direction: -1 | 1) {
    const element = scroller.current;
    if (!element) return;
    holdFor(RESUME_AFTER_TOUCH_MS);
    element.scrollBy({ left: direction * Math.max(120, element.clientWidth * 0.7), behavior: "smooth" });
  }

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Move only when one copy of the list is wider than the row.
  useEffect(() => {
    const view = scroller.current, list = firstList.current; if (!view || !list) return;
    const measure = () => {
      setOverflowing(list.scrollWidth > view.clientWidth + 1);
      const left = view.scrollLeft > 2;
      const right = view.scrollLeft + view.clientWidth < view.scrollWidth - 2;
      setScrollEdges(previous => previous.left === left && previous.right === right ? previous : { left, right });
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(view); observer.observe(list);
    view.addEventListener("scroll", measure, { passive: true });
    return () => { observer.disconnect(); view.removeEventListener("scroll", measure); };
  }, [categories.length, looping]);

  useEffect(() => {
    const el = scroller.current; if (!el || !looping) return;
    secondList.current?.setAttribute("inert", ""); // React 18 has no `inert` prop; keeps the copy out of tab order
    el.style.scrollSnapType = "none"; // snapping would tug against the slow drift
    let frame = 0, last = 0, onScreen = true, position = el.scrollLeft;
    const loopWidth = () => (secondList.current && firstList.current ? secondList.current.offsetLeft - firstList.current.offsetLeft : 0);
    const wrap = () => {
      const width = loopWidth(); if (width <= 0) return;
      if (el.scrollLeft >= width) el.scrollLeft -= width;
      else if (el.scrollLeft <= 0) el.scrollLeft += width;
    };
    const tick = (time: number) => {
      const delta = last ? Math.min(time - last, 64) / 1000 : 0; last = time;
      const p = pause.current;
      if (onScreen && !document.hidden && !p.hover && !p.focus && !p.dragging && time > p.until) {
        if (Math.abs(el.scrollLeft - position) > 2) position = el.scrollLeft; // the user scrolled by hand
        position += PIXELS_PER_SECOND * delta;
        const width = loopWidth(); if (width > 0 && position >= width) position -= width;
        el.scrollLeft = position;
      } else position = el.scrollLeft;
      frame = requestAnimationFrame(tick);
    };
    const visibility = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; });
    visibility.observe(el);
    el.addEventListener("scroll", wrap, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); visibility.disconnect(); el.removeEventListener("scroll", wrap); el.style.scrollSnapType = ""; };
  }, [looping]);

  useEffect(() => {
    const el = scroller.current; if (!el) return;
    // A vertical mouse wheel scrolls the row while it can still move; at either end the page scrolls as usual.
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY) || el.scrollWidth <= el.clientWidth) return;
      const atStart = el.scrollLeft <= 0, atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if ((event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) return;
      event.preventDefault(); el.scrollLeft += event.deltaY; pause.current.until = performance.now() + 1500;
    };
    // Mouse click-and-drag; a real drag swallows the click so it does not open a category.
    let startX = 0, startLeft = 0, dragging = false, moved = false;
    const down = (event: PointerEvent) => { if (event.pointerType !== "mouse" || event.button !== 0) return; dragging = true; moved = false; startX = event.clientX; startLeft = el.scrollLeft; };
    const move = (event: PointerEvent) => {
      if (!dragging) return; const dx = event.clientX - startX;
      if (!moved && Math.abs(dx) > 5) { moved = true; pause.current.dragging = true; el.style.scrollSnapType = "none"; }
      if (moved) el.scrollLeft = startLeft - dx;
    };
    const up = () => {
      if (!dragging) return; dragging = false; pause.current.dragging = false; pause.current.until = performance.now() + 1500;
      if (!el.dataset.looping) el.style.scrollSnapType = "";
    };
    const click = (event: MouseEvent) => { if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; } };
    const noNativeDrag = (event: DragEvent) => event.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", down); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    el.addEventListener("click", click, true); el.addEventListener("dragstart", noNativeDrag);
    return () => {
      el.removeEventListener("wheel", onWheel); el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      el.removeEventListener("click", click, true); el.removeEventListener("dragstart", noNativeDrag);
    };
  }, []);

  if (categories.length === 0) {
    return <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-green-200 bg-white px-6 py-8 text-center">
      <LayoutGrid className="h-6 w-6 text-brand-dark/50" aria-hidden="true" />
      <p className="text-sm font-semibold text-brand-dark">No categories yet</p>
      <p className="text-xs text-black/50">New categories will show up here soon.</p>
      <Link href="/products" className="mt-1 text-xs font-bold text-brand-link hover:underline">Browse all products →</Link>
    </div>;
  }

  return <div className="min-w-0">
    {overflowing && <div className="mb-2 flex items-center justify-end gap-2 text-xs text-brand-dark/60">
      <span className="mr-auto sm:hidden">Swipe to explore categories</span>
      <button type="button" aria-label="Scroll categories left" onClick={() => scrollCategories(-1)} disabled={!looping && !scrollEdges.left} className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 bg-white text-brand-dark shadow-sm disabled:opacity-35"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
      <button type="button" aria-label="Scroll categories right" onClick={() => scrollCategories(1)} disabled={!looping && !scrollEdges.right} className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 bg-white text-brand-dark shadow-sm disabled:opacity-35"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
    </div>}
    <div ref={scroller} data-looping={looping || undefined} className={row}
    onMouseEnter={() => { pause.current.hover = true; }} onMouseLeave={() => { pause.current.hover = false; }}
    onFocusCapture={() => { pause.current.focus = true; }} onBlurCapture={() => { pause.current.focus = false; }}
    onTouchStart={() => holdFor(60_000)} onTouchEnd={() => holdFor(RESUME_AFTER_TOUCH_MS)} onTouchCancel={() => holdFor(RESUME_AFTER_TOUCH_MS)}>
    <div ref={firstList} role="list" aria-label="Product categories" className="flex shrink-0 gap-3 pr-3">
      {categories.map(category => <div key={category.id} role="listitem" className="flex"><CategoryCircle category={category} /></div>)}
    </div>
    {/* Copy for the seamless loop: hidden from screen readers and keyboard. */}
    {looping && <div ref={secondList} aria-hidden="true" className="flex shrink-0 gap-3 pr-3">
      {categories.map(category => <div key={category.id} className="flex"><CategoryCircle category={category} hidden /></div>)}
    </div>}
    </div>
  </div>;
}
