"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Hides a server-rendered Want card as soon as its owner deletes or closes it, without a page reload. */
export function RemovableWant({ wantId, children }: { wantId: string; children: ReactNode }) {
  const [removed, setRemoved] = useState(false);
  useEffect(() => {
    const onDeleted = (event: Event) => { if ((event as CustomEvent<{ id: string }>).detail?.id === wantId) setRemoved(true); };
    window.addEventListener("want-deleted", onDeleted); return () => window.removeEventListener("want-deleted", onDeleted);
  }, [wantId]);
  return removed ? null : <>{children}</>;
}
