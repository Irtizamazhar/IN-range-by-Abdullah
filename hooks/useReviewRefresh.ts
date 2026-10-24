"use client";

import { useEffect, useRef } from "react";
import { PRODUCT_REVIEWS_UPDATED_EVENT } from "@/lib/product-reviews-events";

/** Moderation can happen in another tab/session; refresh only visible, idle UI. */
export function useReviewRefresh(refresh: () => unknown, enabled = true) {
  const current = useRef(refresh);
  current.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    const reload = () => {
      if (document.visibilityState === "visible") current.current();
    };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    window.addEventListener(PRODUCT_REVIEWS_UPDATED_EVENT, reload);
    const timer = window.setInterval(reload, 30_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
      window.removeEventListener(PRODUCT_REVIEWS_UPDATED_EVENT, reload);
    };
  }, [enabled]);
}
