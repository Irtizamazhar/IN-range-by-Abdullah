"use client";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useAsyncActions } from "@/hooks/useAsyncActions";
import toast from "react-hot-toast";

const inFlight = new Map<string, Promise<void>>();

export function useSavedProducts() {
  const { data: session } = useSession();
  const { openAuthModal } = useCustomerAuth();
  const queryClient = useQueryClient();
  const actions = useAsyncActions();
  const customerId = session?.user?.role === "customer" ? session.user.id : "";
  const key = ["customer-saved-products", customerId];
  const query = useQuery<string[]>({ queryKey: key, enabled: !!customerId, staleTime: 0, queryFn: async ({ signal }) => {
    const response = await fetch("/api/customer/saved-products?idsOnly=1", { signal, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load saved products.");
    return data.ids;
  } });

  function toggle(productId: string) {
    if (!customerId) return openAuthModal("login");
    return actions.run(productId, async () => {
      const requestKey = `${customerId}:${productId}`;
      const existing = inFlight.get(requestKey);
      if (existing) return existing;
      const request = (async () => {
        try {
          let ids = queryClient.getQueryData<string[]>(key);
          if (!ids || query.isError) {
            const result = await query.refetch();
            if (result.error) throw result.error;
            ids = result.data || [];
          }
          const saved = ids.includes(productId);
          const response = await fetch(`/api/customer/saved-products${saved ? `/${encodeURIComponent(productId)}` : ""}`, {
            method: saved ? "DELETE" : "POST", headers: { "Content-Type": "application/json" },
            ...(saved ? {} : { body: JSON.stringify({ productId }) }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Could not update saved products.");
          queryClient.setQueryData<string[]>(key, old => saved ? (old || []).filter(id => id !== productId) : Array.from(new Set([...(old || []), productId])));
          window.dispatchEvent(new Event("customer-saved-products-changed"));
          toast.success(saved ? "Product removed from saved items." : "Product saved.");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not save product. Please try again.");
        }
      })().finally(() => { inFlight.delete(requestKey); });
      inFlight.set(requestKey, request);
      return request;
    });
  }

  return { ids: customerId ? query.data || [] : [], toggle, saving: actions.pending.size > 0, isSaving: actions.isPending, loading: !!customerId && query.isLoading };
}
