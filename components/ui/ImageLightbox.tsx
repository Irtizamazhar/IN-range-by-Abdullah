"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { lockPageScroll } from "@/lib/scroll-lock";

/** Full-screen image viewer: X / Esc close, arrows (buttons or keyboard) step through multiple images. */
export function ImageLightbox({ images, startIndex = 0, title, onClose }: { images: string[]; startIndex?: number; title: string; onClose: () => void }) {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), images.length - 1));
  const closeButton = useRef<HTMLButtonElement>(null);
  const many = images.length > 1;
  const step = useCallback((delta: number) => setIndex(current => (current + delta + images.length) % images.length), [images.length]);

  useEffect(() => {
    const unlock = lockPageScroll();
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    return () => { unlock(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      else if (many && event.key === "ArrowRight") step(1);
      else if (many && event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [many, onClose, step]);

  if (!images.length) return null;
  const arrow = "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-emerald-950 shadow-lg hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary";
  return createPortal(<div role="dialog" aria-modal="true" aria-label={`${title} images`} className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden bg-[#062819]/85 p-4 backdrop-blur-sm sm:p-8" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <button ref={closeButton} type="button" aria-label="Close image viewer" onClick={onClose} className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-emerald-950 shadow-lg hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary sm:right-5 sm:top-5"><X className="h-5 w-5" aria-hidden="true" /></button>
    {many && <button type="button" aria-label="Previous image" onClick={() => step(-1)} className={`${arrow} left-2 sm:left-5`}><ChevronLeft className="h-6 w-6" aria-hidden="true" /></button>}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={images[index]} alt={`${title} — image ${index + 1} of ${images.length}`} className="max-h-[85dvh] max-w-full rounded-2xl bg-white object-contain shadow-2xl" />
    {many && <button type="button" aria-label="Next image" onClick={() => step(1)} className={`${arrow} right-2 sm:right-5`}><ChevronRight className="h-6 w-6" aria-hidden="true" /></button>}
    {many && <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm font-semibold text-white" aria-live="polite">{index + 1} / {images.length}</p>}
  </div>, document.body);
}
