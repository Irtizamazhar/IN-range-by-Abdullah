"use client";

import { useSyncExternalStore } from "react";

type PendingNavigation = { id: number; href: string | null; source: "router" | "history" };
const listeners = new Set<() => void>();
let current: PendingNavigation | null = null;
let nextId = 0;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;

function notify() { listeners.forEach(listener => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function clearTimer() { if (safetyTimer) clearTimeout(safetyTimer); safetyTimer = null; }

export function beginNavigation(href: string | null, source: "router" | "history" = "router"): number {
  clearTimer();
  const id = ++nextId;
  current = { id, href, source };
  notify();
  // A failed or abandoned route transition must never leave a blocking overlay.
  safetyTimer = setTimeout(() => finishNavigation(id), 15000);
  return id;
}

export function finishNavigation(id?: number) {
  if (!current || (id !== undefined && current.id !== id)) return;
  clearTimer();
  current = null;
  notify();
}

export function usePendingNavigation() {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
