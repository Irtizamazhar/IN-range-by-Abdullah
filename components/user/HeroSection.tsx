"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";

const words = [
  "Your Reach 🎯",
  "Your Budget 💰",
  "Your Hands 📦",
  "Your Home 🏠",
];

export function HeroSection({ sellNowHref }: { sellNowHref: string }) {
  const [currentWord, setCurrentWord] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const fullWord = words[wordIndex];

    if (isPaused) {
      const pauseTimeout = window.setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, 2000);
      return () => window.clearTimeout(pauseTimeout);
    }

    const timeout = window.setTimeout(
      () => {
        if (!isDeleting) {
          const nextWord = fullWord.slice(0, currentWord.length + 1);
          setCurrentWord(nextWord);
          if (nextWord === fullWord) {
            setIsPaused(true);
          }
        } else {
          const nextWord = currentWord.slice(0, -1);
          setCurrentWord(nextWord);
          if (nextWord === "") {
            setIsDeleting(false);
            setWordIndex((prev) => (prev + 1) % words.length);
          }
        }
      },
      isDeleting ? 40 : 80
    );

    return () => window.clearTimeout(timeout);
  }, [currentWord, isDeleting, isPaused, wordIndex]);

  return (
    <section className="relative isolate overflow-hidden bg-[#16213e] text-white">
      <div className="absolute inset-0 z-0 bg-[#16213e] pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <video
          src="/videos/mixkit-delivering-a-package-to-a-woman-at-home-42130-full-hd.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="h-full w-full object-cover bg-[#16213e]"
        />
      </div>

      <div className="relative z-20 mx-auto max-w-7xl px-4 py-24 md:py-40 text-center">
        <div className="flex flex-col items-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm">
            🛍️ Pakistan&apos;s #1 Budget Shop
          </span>

          <h1 className="text-5xl font-extrabold leading-tight text-white drop-shadow-lg">
            Everything Within
          </h1>

          <div className="mt-1 flex items-center justify-center min-h-[3.25rem] md:min-h-[4.5rem]">
            <h2 className="text-5xl font-extrabold text-yellow-300">
              {currentWord}
            </h2>
            <span className="ml-1 animate-pulse text-5xl font-light text-yellow-300">
              |
            </span>
          </div>

          <p className="mt-4 max-w-xl text-md font-normal leading-relaxed text-white/80 opacity-0 animate-[fadeIn_0.6s_ease_forwards] [animation-delay:500ms]">
            Quality products — COD &amp; bank transfer across Pakistan.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/products"
              className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 px-10 py-4 text-md font-semibold text-gray-900 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/40"
            >
              <ShoppingBag className="h-6 w-6" />
              Shop Now
            </Link>
            <a
              href={sellNowHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/40 px-8 py-4 text-md font-semibold text-white transition hover:bg-white/10"
            >
              Sell Now →
            </a>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/30 px-8 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 text-sm font-medium text-white/90 md:gap-12">
          <span>✅ 5000+ Orders Delivered</span>
          <span>📦 COD Available</span>
          <span>⚡ Fast Delivery</span>
          <span>🌟 4.8 Rating</span>
        </div>
      </div>
    </section>
  );
}

