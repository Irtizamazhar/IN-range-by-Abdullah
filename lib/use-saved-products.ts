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
          await queryClient.cancelQueries({ queryKey: key });
          const ids = queryClient.getQueryData<string[]>(key);
          if (!ids || query.isError) throw new Error("Saved products are unavailable. Please try again.");
          const saved = ids.includes(productId);
          queryClient.setQueryData<string[]>(key, saved ? ids.filter(id => id !== productId) : [...ids, productId]);
          try {
            const response = await fetch(`/api/customer/saved-products${saved ? `/${encodeURIComponent(productId)}` : ""}`, {
              method: saved ? "DELETE" : "POST", headers: { "Content-Type": "application/json" },
              ...(saved ? {} : { body: JSON.stringify({ productId }) }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Could not update saved products.");
            window.dispatchEvent(new Event("customer-saved-products-changed"));
            toast.success(saved ? "Product removed from saved items." : "Product saved.");
          } catch (error) {
            queryClient.setQueryData<string[]>(key, current => saved
              ? Array.from(new Set([...(current || []), productId]))
              : (current || []).filter(id => id !== productId));
            throw error;
          }
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
