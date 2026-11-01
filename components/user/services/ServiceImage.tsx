"use client";
import Image from "next/image";
import { useState } from "react";
import { Wrench } from "lucide-react";
import { serviceImageCandidates } from "@/lib/service-image-policy";

export function ServiceImage({ imageUrl, defaultImageUrl, alt, sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw", className = "" }: {
  imageUrl?: string | null; defaultImageUrl?: string | null; alt: string; sizes?: string; className?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const source = serviceImageCandidates(imageUrl, defaultImageUrl).find(url => !failed.includes(url));
  return <div className={`relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-[#005055]/5 ${className}`}>
    {source ? <Image key={source} src={source} alt={alt} fill sizes={sizes} className="object-cover object-center" onError={() => setFailed(previous => [...previous, source])} />
      : <div role="img" aria-label={`${alt} — image unavailable`} className="flex h-full flex-col items-center justify-center gap-2 text-[#005055]"><Wrench aria-hidden="true" className="h-9 w-9" /><span className="text-sm font-black tracking-widest">JORO</span></div>}
  </div>;
}
