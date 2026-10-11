"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { beginNavigation, finishNavigation, usePendingNavigation } from "@/hooks/navigationLoadingStore";
import { loadingMessageForRoute, loadingNeedsOpaqueBackground } from "@/lib/loading-route-message";
import { GlobalLoaderVisual } from "./GlobalLoaderVisual";
import styles from "./GlobalLoader.module.css";

export function GlobalNavigationLoader() {
  const pathname = usePathname();
  const search = useSearchParams();
  const route = `${pathname || "/"}${search?.toString() ? `?${search.toString()}` : ""}`;
  const pending = usePendingNavigation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pending) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(true), 180);
    return () => clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    const onHistory = () => beginNavigation(window.location.pathname + window.location.search, "history");
    window.addEventListener("popstate", onHistory);
    return () => window.removeEventListener("popstate", onHistory);
  }, []);

  useEffect(() => {
    if (pending?.source === "history" && pending.href === route) finishNavigation(pending.id);
  }, [pending, route]);

  if (!pending || !visible) return null;
  const destination = pending.href || route;
  const opaque = loadingNeedsOpaqueBackground(route) || loadingNeedsOpaqueBackground(destination);
  return <div className={`${styles.overlay} ${opaque ? styles.opaque : ""}`} aria-busy="true" data-global-loader="true">
    <GlobalLoaderVisual message={loadingMessageForRoute(destination)} />
  </div>;
}
