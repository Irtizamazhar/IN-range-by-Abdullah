"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

/**
 * Customer reference images for a Want. `thumbnail` shows the first image (16:9) with a View badge and "+N";
 * `grid` shows every image. Both open the shared lightbox. Renders nothing when there are no images.
 */
export function WantImageGallery({ images, title, variant = "grid", className = "" }: { images: string[]; title: string; variant?: "thumbnail" | "grid"; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!images.length) return null;
  const viewer = open !== null && <ImageLightbox images={images} startIndex={open} title={title} onClose={() => setOpen(null)} />;

  if (variant === "thumbnail") return <>
    <button type="button" onClick={() => setOpen(0)} aria-label={`View ${images.length === 1 ? "image" : `${images.length} images`} for ${title}`} className={`group relative block aspect-video w-full overflow-hidden rounded-xl border bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[0]} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-emerald-950 shadow"><Eye className="h-3.5 w-3.5" aria-hidden="true" />View</span>
      {images.length > 1 && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">+{images.length - 1}</span>}
    </button>
    {viewer}
  </>;

  return <>
    <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"} ${className}`}>
      {images.map((src, index) => <button key={src + index} type="button" onClick={() => setOpen(index)} aria-label={`View image ${index + 1} of ${images.length} for ${title}`} className={`group relative overflow-hidden rounded-2xl border bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${images.length === 1 ? "aspect-video max-h-96" : "aspect-square"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" loading="lazy" className={`h-full w-full transition duration-300 group-hover:scale-[1.02] ${images.length === 1 ? "object-contain" : "object-cover"}`} />
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-emerald-950 shadow"><Eye className="h-3.5 w-3.5" aria-hidden="true" />View</span>
      </button>)}
    </div>
    {viewer}
  </>;
}
