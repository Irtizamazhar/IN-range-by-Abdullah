"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";

const pendingPages = new Set<symbol>();
const subscribers = new Set<() => void>();
function publish() { subscribers.forEach(notify => notify()); }
function subscribe(notify: () => void) { subscribers.add(notify); return () => { subscribers.delete(notify); }; }
const snapshot = () => pendingPages.size;
const serverSnapshot = () => 0;
const useCommitEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
export const hasPendingPages = () => pendingPages.size > 0;

/** A fetching page/skeleton holds navigation pending until its content or error is ready. */
export function usePageLoading(loading: boolean) {
  useCommitEffect(() => {
    if (!loading) return;
    const token = Symbol("page-loading");
    pendingPages.add(token);
    publish();
    return () => { pendingPages.delete(token); publish(); };
  }, [loading]);
}

export function usePendingPages() { return useSyncExternalStore(subscribe, snapshot, serverSnapshot); }
