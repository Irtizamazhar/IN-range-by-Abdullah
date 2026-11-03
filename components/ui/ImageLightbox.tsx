"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { lockPageScroll } from "@/lib/scroll-lock";

/** Full-screen image viewer: X / Esc close, arrows (buttons or keyboard) step through multiple images; `zoomable` adds a 2× zoom toggle. */
export function ImageLightbox({ images, startIndex = 0, title, onClose, zoomable = false }: { images: string[]; startIndex?: number; title: string; onClose: () => void; zoomable?: boolean }) {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), images.length - 1));
  const [zoomed, setZoomed] = useState(false);
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
    {zoomable && <button type="button" aria-label={zoomed ? "Zoom out" : "Zoom in"} aria-pressed={zoomed} onClick={() => setZoomed(z => !z)} className="absolute right-16 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-emerald-950 shadow-lg hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary sm:right-[4.75rem] sm:top-5">{zoomed ? <ZoomOut className="h-5 w-5" aria-hidden="true" /> : <ZoomIn className="h-5 w-5" aria-hidden="true" />}</button>}
    {zoomed
      ? <div className="max-h-[85dvh] max-w-full overflow-auto overscroll-contain rounded-2xl bg-white shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[index]} alt={`${title} — image ${index + 1} of ${images.length}, zoomed`} onClick={() => setZoomed(false)} className="block w-[200vw] max-w-none cursor-zoom-out sm:w-[160vw]" />
      </div>
      // eslint-disable-next-line @next/next/no-img-element
      : <img src={images[index]} alt={`${title} — image ${index + 1} of ${images.length}`} onClick={zoomable ? () => setZoomed(true) : undefined} className={"max-h-[85dvh] max-w-full rounded-2xl bg-white object-contain shadow-2xl" + (zoomable ? " cursor-zoom-in" : "")} />}
    {many && <button type="button" aria-label="Next image" onClick={() => step(1)} className={`${arrow} right-2 sm:right-5`}><ChevronRight className="h-6 w-6" aria-hidden="true" /></button>}
    {many && <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm font-semibold text-white" aria-live="polite">{index + 1} / {images.length}</p>}
  </div>, document.body);
}
