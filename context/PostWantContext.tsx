"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { PostWantModal } from "@/components/user/PostWantModal";

const RESUME_KEY = "joro:post-want:resume:v1";
const PostWantContext = createContext<{ openPostWant: (initialTitle?: string) => void } | null>(null);

export function PostWantProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{ initialTitle: string } | null>(null);
  const { isCustomer, authLoading } = useCustomerAuth();
  const pathname = usePathname();
  const openPostWant = useCallback((initialTitle = "") => { setRequest(current => current || { initialTitle }); }, []);
  const closePostWant = useCallback(() => setRequest(null), []);
  const rememberSignIn = useCallback(() => {
    try { sessionStorage.setItem(RESUME_KEY, JSON.stringify({ initialTitle: request?.initialTitle || "", returnTo: window.location.pathname + window.location.search, createdAt: Date.now() })); }
    catch { /* The login route remains usable when browser storage is unavailable. */ }
  }, [request]);

  useEffect(() => {
    if (authLoading || !isCustomer) return;
    try {
      const raw = sessionStorage.getItem(RESUME_KEY); if (!raw) return;
      const pending = JSON.parse(raw);
      if (typeof pending.createdAt !== "number" || Date.now() - pending.createdAt > 60 * 60 * 1000) { sessionStorage.removeItem(RESUME_KEY); return; }
      if (pending.returnTo === window.location.pathname + window.location.search) {
        sessionStorage.removeItem(RESUME_KEY);
        openPostWant(typeof pending.initialTitle === "string" ? pending.initialTitle : "");
      }
    } catch { /* A stale or unavailable draft marker must not prevent browsing. */ }
  }, [authLoading, isCustomer, pathname, openPostWant]);

  const value = useMemo(() => ({ openPostWant }), [openPostWant]);
  return <PostWantContext.Provider value={value}>
    {children}
    {request && <PostWantModal initialTitle={request.initialTitle} onClose={closePostWant} onSignIn={rememberSignIn} />}
  </PostWantContext.Provider>;
}

export function usePostWant() {
  const context = useContext(PostWantContext);
  if (!context) throw new Error("usePostWant must be used within PostWantProvider");
  return context;
}
