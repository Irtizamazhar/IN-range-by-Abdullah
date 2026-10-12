"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { ContainedImage } from "@/components/user/ContainedImage";
import { demandType } from "./DemandBits";

/**
 * Top of the demand detail card: the main image (whole, never cropped) in a 16:9 box, a thumbnail row to
 * switch it, and the shared lightbox from the View pill.
 */
export function DemandGallery({ images, title, requestType }: { images: string[]; title: string; requestType: string }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const type = demandType(requestType);
  const placeholder = <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lime-100 text-emerald-700"><type.Icon className="h-8 w-8" aria-hidden="true" /></span>;

  return <div>
    <div className="relative aspect-video overflow-hidden rounded-t-2xl bg-[#F4F8EF]">
      <ContainedImage src={images[active]} sizes="(min-width: 1280px) 520px, (min-width: 768px) 70vw, 100vw" priority fallback={placeholder} />
      {images.length > 0 && <button type="button" onClick={() => setOpen(true)} aria-label={`View ${images.length === 1 ? "image" : `image ${active + 1} of ${images.length}`} for ${title}`}
        className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-emerald-950 shadow hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />View</button>}
    </div>
    {images.length > 1 && <div className="flex gap-2 overflow-x-auto px-4 pt-3 sm:px-5">
      {images.map((src, index) => <button key={src + index} type="button" onClick={() => setActive(index)} aria-label={`Show image ${index + 1}`} aria-pressed={index === active}
        className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2 bg-[#F4F8EF] ${index === active ? "border-emerald-600" : "border-[#D9E6D0] hover:border-emerald-300"}`}>
        <ContainedImage src={src} sizes="44px" padding="p-0.5" fallback={null} />
      </button>)}
    </div>}
    {open && <ImageLightbox images={images} startIndex={active} title={title} onClose={() => setOpen(false)} />}
  </div>;
}
