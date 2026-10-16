"use client";
import { Heart } from "lucide-react";
import { useSavedProducts } from "@/lib/use-saved-products";

export function SaveProductButton({ productId, name }: { productId: string; name: string }) {
  const { ids, toggle, isSaving, loading } = useSavedProducts();
  const saved = ids.includes(productId);
  return <button type="button" aria-pressed={saved} aria-label={saved ? `Remove ${name} from saved items` : `Save ${name}`} disabled={loading || isSaving(productId)} onClick={() => void toggle(productId)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-link transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-link disabled:opacity-60"><Heart aria-hidden="true" className={`h-4 w-4 ${saved ? "fill-current text-rose-600" : ""}`}/>{saved ? "Saved" : "Save item"}</button>;
}
