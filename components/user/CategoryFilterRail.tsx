"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "@/components/ui/LoadingLink";

type CategoryLink = { label: string; value: string; href: string };

export function CategoryFilterRail({ label, items, selected }: {
  label: string;
  items: CategoryLink[];
  selected: string;
}) {
  const rail = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const active = element.querySelector<HTMLElement>('[aria-current="page"]');
    if (active) element.scrollLeft += active.getBoundingClientRect().left - element.getBoundingClientRect().left - (element.clientWidth - active.clientWidth) / 2;
    const update = () => {
      const left = element.scrollLeft > 2;
      const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
      setEdges(previous => previous.left === left && previous.right === right ? previous : { left, right });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [items]);

  function scroll(direction: -1 | 1) {
    rail.current?.scrollBy({ left: direction * Math.max(120, rail.current.clientWidth * 0.7), behavior: "smooth" });
  }

  return <div className="mt-6 min-w-0">
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold text-brand-dark">{label}</h2>
      {(edges.left || edges.right) && <div className="flex gap-1.5">
        <button type="button" aria-label={`Scroll ${label.toLowerCase()} left`} disabled={!edges.left} onClick={() => scroll(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 bg-white text-brand-dark disabled:opacity-35"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" aria-label={`Scroll ${label.toLowerCase()} right`} disabled={!edges.right} onClick={() => scroll(1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-green-200 bg-white text-brand-dark disabled:opacity-35"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
      </div>}
    </div>
    <nav ref={rail} aria-label={label} className="flex min-w-0 snap-x gap-2 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map(item => <Link key={item.value} href={item.href} aria-current={selected === item.value ? "page" : undefined} className={`flex min-h-11 shrink-0 snap-start items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors ${selected === item.value ? "border-[#005235] bg-[#005235] text-white" : "border-green-200 bg-white text-brand-dark hover:bg-brand-soft"}`}>{item.label}</Link>)}
    </nav>
  </div>;
}
