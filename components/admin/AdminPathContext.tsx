"use client";

import { createContext, useContext, useMemo } from "react";
import { setAdminRoutePrefix } from "@/lib/loading-route-message";

/**
 * Admin panel base URL (ADMIN_SECRET_PATH), handed down from the server layout so the
 * secret never appears in the public JavaScript bundles.
 */
const AdminPathContext = createContext("");

export function AdminPathProvider({ base, children }: { base: string; children: React.ReactNode }) {
  // Lets the shared route loader recognise admin URLs; only ever set inside the admin panel.
  setAdminRoutePrefix(base);
  return <AdminPathContext.Provider value={base}>{children}</AdminPathContext.Provider>;
}

export function useAdminPath() {
  const base = useContext(AdminPathContext);
  return useMemo(
    () => ({
      /** Public admin URL for a sub-path, e.g. href("/orders"). */
      href: (subPath = "") => base + subPath,
      /** Admin sub-path of the current URL, e.g. "/orders" for "<base>/orders". */
      local: (pathname: string | null) =>
        pathname && (pathname === base || pathname.startsWith(base + "/"))
          ? pathname.slice(base.length) || "/"
          : null,
    }),
    [base]
  );
}
