"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { shouldUnoptimizeImageSrc } from "@/lib/should-unoptimize-next-image";

/**
 * Shows a whole image centred inside its (sized, relative) parent: natural size, capped to the box, so it is
 * never cropped, stretched or enlarged past its real resolution. Renders `fallback` when missing or broken.
 */
export function ContainedImage({ src, alt = "", sizes, fallback, priority = false, padding = "p-1" }: { src?: string | null; alt?: string; sizes: string; fallback: ReactNode; priority?: boolean; padding?: string }) {
  const [failed, setFailed] = useState(false);
  return <span className={`absolute inset-0 flex items-center justify-center ${padding}`}>
    {src && !failed
      ? <Image src={src} alt={alt} width={800} height={600} sizes={sizes} priority={priority} loading={priority ? undefined : "lazy"} unoptimized={shouldUnoptimizeImageSrc(src)} onError={() => setFailed(true)} className="h-auto max-h-full w-auto max-w-full object-contain" />
      : fallback}
  </span>;
}
