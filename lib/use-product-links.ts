"use client";
import { useQuery } from "@tanstack/react-query";
/** Refresh navigation for historical cart/order snapshots without modifying them. */
export function useProductLinks(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean))).sort();
  return useQuery<Record<string, string>>({
    queryKey: ["public-product-links", unique], enabled: unique.length > 0, staleTime: 60_000,
    queryFn: async () => {
      const entries = await Promise.all(Array.from({ length: Math.ceil(unique.length / 100) }, async (_, i) => {
        const query = new URLSearchParams();
        unique.slice(i * 100, (i + 1) * 100).forEach(id => query.append("id", id));
        const response = await fetch("/api/product-links?" + query, { credentials: "omit" });
        if (!response.ok) throw new Error("Product links unavailable");
        return response.json() as Promise<Record<string, string>>;
      }));
      return Object.assign({}, ...entries) as Record<string, string>;
    },
  }).data || {};
}
