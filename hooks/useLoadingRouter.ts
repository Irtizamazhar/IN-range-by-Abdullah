"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { hasPendingPages, usePendingPages } from "./usePageLoading";
import { beginNavigation, finishNavigation } from "./navigationLoadingStore";

/** Await the real React/Next route transition, including suspended destination work. */
export function useLoadingRouter() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [version, setVersion] = useState(0);
  const pendingPages = usePendingPages();
  const waiters = useRef<Array<{ resolve: () => void; reject: (error: unknown) => void }>>([]);
  const mounted = useRef(true);

  useEffect(() => {
    if (!isPending && !hasPendingPages()) waiters.current.splice(0).forEach(waiter => waiter.resolve());
  }, [isPending, version, pendingPages]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; waiters.current.splice(0).forEach(waiter => waiter.resolve()); }; }, []);

  const transition = useCallback((action: () => void, destination?: string | null) => new Promise<void>((resolve, reject) => {
    if (!mounted.current) { try { action(); resolve(); } catch (error) { reject(error); } return; }
    const token = destination === undefined ? null : beginNavigation(destination);
    waiters.current.push({ resolve: () => { if (token !== null) finishNavigation(token); resolve(); }, reject: error => { if (token !== null) finishNavigation(token); reject(error); } });
    setVersion(value => value + 1);
    try { startTransition(action); }
    catch (error) { waiters.current.splice(0).forEach(waiter => waiter.reject(error)); }
  }), []);

  const push = useCallback((href: string, options?: Parameters<typeof router.push>[1]) => transition(() => router.push(href, options), href), [router, transition]);
  const replace = useCallback((href: string, options?: Parameters<typeof router.replace>[1]) => transition(() => router.replace(href, options), href), [router, transition]);
  const refresh = useCallback(() => transition(() => router.refresh()), [router, transition]);
  const back = useCallback(() => transition(() => router.back(), null), [router, transition]);
  const forward = useCallback(() => transition(() => router.forward(), null), [router, transition]);

  return useMemo(() => ({ ...router, push, replace, refresh, back, forward }), [router, push, replace, refresh, back, forward]);
}
