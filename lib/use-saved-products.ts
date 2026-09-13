"use client";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import toast from "react-hot-toast";
export function useSavedProducts() {
  const { data: session } = useSession(); const { openAuthModal } = useCustomerAuth(); const queryClient = useQueryClient(); const [saving, setSaving] = useState(false);
  const customerId = session?.user?.role === "customer" ? session.user.id : "";
  const key = ["customer-saved-products", customerId];
  const query = useQuery<string[]>({ queryKey: key, enabled: !!customerId, staleTime: 0, queryFn: async ({ signal }) => { const r = await fetch("/api/customer/saved-products?idsOnly=1", { signal, cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not load saved products."); return d.ids; } });
  async function toggle(productId: string) {
    if (!customerId) { openAuthModal("login"); return; }
    if (saving || query.isLoading) return;
    if (query.isError) { toast.error("Saved products could not be loaded. Please refresh."); return; }
    const saved = query.data?.includes(productId); setSaving(true);
    try {
      const r = await fetch(`/api/customer/saved-products${saved ? `/${encodeURIComponent(productId)}` : ""}`, { method: saved ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, ...(saved ? {} : { body: JSON.stringify({ productId }) }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not update saved products.");
      queryClient.setQueryData<string[]>(key, old => saved ? (old || []).filter(id => id !== productId) : Array.from(new Set([...(old || []), productId])));
      window.dispatchEvent(new Event("customer-saved-products-changed"));
    } catch(e) { toast.error(e instanceof Error ? e.message : "Could not save product."); } finally { setSaving(false); }
  }
  return { ids: customerId ? query.data || [] : [], toggle, saving, loading: !!customerId && query.isLoading };
}