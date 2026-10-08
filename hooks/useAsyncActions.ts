"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Keys belong to an action (including its row ID), never to an entire page. */
export function useAsyncActions() {
  const requests = useRef(new Map<string, Promise<unknown>>());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = useCallback(<T,>(key: string, action: () => Promise<T>): Promise<T> => {
    const existing = requests.current.get(key);
    if (existing) return existing as Promise<T>;
    // Queue the function so the guard is installed before even synchronous work runs.
    const request = Promise.resolve().then(action).finally(() => {
      requests.current.delete(key);
      if (mounted.current) setPending(new Set(requests.current.keys()));
    });
    requests.current.set(key, request);
    setPending(new Set(requests.current.keys()));
    return request;
  }, []);
  return { run, isPending: (key: string) => pending.has(key), pending };
}
