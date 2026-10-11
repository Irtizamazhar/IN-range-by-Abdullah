"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { usePageLoading } from "@/hooks/usePageLoading";
import { usePendingNavigation } from "@/hooks/navigationLoadingStore";
import { loadingMessageForRoute } from "@/lib/loading-route-message";
import { GlobalLoaderVisual } from "./GlobalLoaderVisual";
import styles from "./GlobalLoader.module.css";

/** Loading boundary for direct loads. An active global overlay owns the visual during client navigation. */
export function RouteLoading({ routeHint }: { routeHint?: string }) {
  usePageLoading(true);
  const pathname = usePathname();
  const search = useSearchParams();
  const pending = usePendingNavigation();
  const route = pending?.href || `${pathname || routeHint || "/"}${search?.toString() ? `?${search.toString()}` : ""}`;
  if (pending) return <div className={styles.placeholder} aria-hidden="true" />;
  return <div className={styles.fallback} aria-busy="true"><GlobalLoaderVisual message={loadingMessageForRoute(route)} /></div>;
}
