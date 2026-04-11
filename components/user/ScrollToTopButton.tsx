"use client";

import { useEffect, useState } from "react";

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 300);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function onClick() {
    setPressed(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => setPressed(false), 160);
  }

  return (
    <div
      className={`group fixed z-[9999] bottom-[calc(1.25rem+3.5rem+0.75rem)] right-5 transition-all duration-300 md:bottom-[calc(30px+3.5rem+12px)] md:right-[30px] ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
     

      <button
        type="button"
        onClick={onClick}
        aria-label="Scroll to top"
        className={`group relative flex h-11 w-11 md:h-[50px] md:w-[50px] items-center justify-center rounded-full border-2 border-white/30 bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] text-white shadow-[0_4px_20px_rgba(14,165,233,0.5)] transition-all duration-300 hover:from-[#F59E0B] hover:to-[#F59E0B] hover:shadow-[0_4px_22px_rgba(245,158,11,0.55)] ${
          pressed ? "scale-90" : "scale-100"
        }`}
      >
        <span className="scroll-top-ring" />
        <span className="scroll-top-dot" />
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 transition-transform duration-300 group-hover:-translate-y-[3px]"
          aria-hidden="true"
        >
          <path
            d="M12 5l-6 6 1.6 1.6 3.3-3.3V19h2.2V9.3l3.3 3.3L18 11z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
}
